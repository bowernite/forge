#!/bin/bash

# Build all TypeScript files in the projects directory
# This script recursively finds and compiles all .ts files

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build all TypeScript files
build_all() {
    print_status "Building all TypeScript files in projects directory..."
    
    # Create bin directory if it doesn't exist
    mkdir -p bin
    
    # Find and build all TypeScript files
    find projects -name '*.ts' | while read -r file; do
        if [[ "$file" == "projects/example.ts" ]]; then
            continue
        fi

        print_status "Building: $file"
        
        # Get the relative path without extension for output naming
        relative_path="${file#projects/}"
        output_name="${relative_path%.ts}"
        
        # Skip pure config files (they don't need to be built as standalone CLIs)
        if [[ "$file" == *"-config.ts" ]] || [[ "$file" == *"Config.ts" ]]; then
            print_status "Skipping config file: $file"
            continue
        fi
        
        # Build the file directly to bin directory
        bun build --compile --outfile="bin/$output_name" "$file"
    done
    
    # Clean up temporary files
    rm -f .*.bun-build
    
    print_success "Build complete! All files compiled to bin/ directory"
}

# Function to install binaries to /usr/local/bin
install_binaries() {
    print_status "Installing binaries to /usr/local/bin..."
    
    # Check if /usr/local/bin exists and is writable
    if [ ! -d "/usr/local/bin" ]; then
        print_error "/usr/local/bin directory does not exist"
        exit 1
    fi
    
    # Get the absolute path to the bin directory
    BIN_DIR="$(pwd)/bin"
    
    # Check if we can write to /usr/local/bin
    if [ ! -w "/usr/local/bin" ]; then
        print_warning "/usr/local/bin is not writable. Installation requires sudo privileges."
        print_status "Please run the following commands manually:"
        echo ""
        
        # Install each binary
        for binary in bin/*; do
            if [ -f "$binary" ] && [ -x "$binary" ]; then
                binary_name=$(basename "$binary")
                target_path="/usr/local/bin/$binary_name"
                
                # Check if already installed
                if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$BIN_DIR/$binary_name" ]; then
                    print_success "$binary_name is already installed and up to date"
                else
                    print_status "To install $binary_name, run:"
                    echo "  sudo ln -sf \"$BIN_DIR/$binary_name\" \"$target_path\""
                fi
            fi
        done
        
        echo ""
        print_status "After running the above commands, you can use the commands from anywhere in your terminal."
        return 0
    fi
    
    # Install each binary (we have write access)
    for binary in bin/*; do
        if [ -f "$binary" ] && [ -x "$binary" ]; then
            binary_name=$(basename "$binary")
            target_path="/usr/local/bin/$binary_name"
            
            print_status "Installing $binary_name..."
            
            # Create symlink
            if ln -sf "$BIN_DIR/$binary_name" "$target_path"; then
                print_success "Installed $binary_name to $target_path"
            else
                print_error "Failed to install $binary_name"
                exit 1
            fi
        fi
    done
    
    print_success "All binaries installed successfully!"
    print_status "You can now use the commands from anywhere in your terminal."
}

# Function to uninstall binaries from /usr/local/bin
uninstall_binaries() {
    print_status "Uninstalling binaries from /usr/local/bin..."
    
    # Get list of binaries to uninstall
    for binary in bin/*; do
        if [ -f "$binary" ]; then
            binary_name=$(basename "$binary")
            target_path="/usr/local/bin/$binary_name"
            
            if [ -L "$target_path" ] || [ -f "$target_path" ]; then
                print_status "Removing $binary_name..."
                
                # Remove symlink/file (use sudo if needed)
                if rm "$target_path" 2>/dev/null; then
                    print_success "Removed $binary_name from $target_path"
                else
                    print_status "Trying with sudo..."
                    if sudo rm "$target_path"; then
                        print_success "Removed $binary_name from $target_path (with sudo)"
                    else
                        print_error "Failed to remove $binary_name - check permissions or try running manually:"
                        print_error "sudo rm \"$target_path\""
                        exit 1
                    fi
                fi
            else
                print_warning "$binary_name not found in /usr/local/bin"
            fi
        fi
    done
    
    print_success "Uninstall complete!"
}

# Main script logic
case "${1:-build}" in
    "build")
        build_all
        ;;
    "install")
        build_all
        install_binaries
        ;;
    "uninstall")
        uninstall_binaries
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build     Build all TypeScript files (default)"
        echo "  install   Build and install binaries to /usr/local/bin (use 'bun run global-install')"
        echo "  uninstall Remove binaries from /usr/local/bin (use 'bun run global-uninstall')"
        echo "  help      Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
