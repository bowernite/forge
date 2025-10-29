#!/bin/bash

# Install binaries to /usr/local/bin

set -e  # Exit on any error

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

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

# Main script logic
install_binaries

