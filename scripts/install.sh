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
    USE_SUDO=false
    if [ ! -w "/usr/local/bin" ]; then
        print_warning "/usr/local/bin is not writable. Attempting installation with sudo..."
        USE_SUDO=true
    fi
    
    # Install each binary
    FAILED_INSTALLS=()
    for binary in bin/*; do
        if [ -f "$binary" ] && [ -x "$binary" ]; then
            binary_name=$(basename "$binary")
            target_path="/usr/local/bin/$binary_name"
            
            # Check if already installed and up to date
            if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$BIN_DIR/$binary_name" ]; then
                print_success "$binary_name is already installed and up to date"
                continue
            fi
            
            print_status "Installing $binary_name..."
            
            # Create symlink (with or without sudo)
            if [ "$USE_SUDO" = true ]; then
                if sudo ln -sf "$BIN_DIR/$binary_name" "$target_path" 2>/dev/null; then
                    print_success "Installed $binary_name to $target_path"
                else
                    FAILED_INSTALLS+=("$binary_name")
                fi
            else
                if ln -sf "$BIN_DIR/$binary_name" "$target_path"; then
                    print_success "Installed $binary_name to $target_path"
                else
                    FAILED_INSTALLS+=("$binary_name")
                fi
            fi
        fi
    done
    
    # If any installations failed, show manual instructions
    if [ ${#FAILED_INSTALLS[@]} -gt 0 ]; then
        echo ""
        print_error "Failed to install some binaries. Please run the following commands manually:"
        echo ""
        for binary_name in "${FAILED_INSTALLS[@]}"; do
            target_path="/usr/local/bin/$binary_name"
            echo "  sudo ln -sf \"$BIN_DIR/$binary_name\" \"$target_path\""
        done
        echo ""
        exit 1
    fi
    
    print_success "All binaries installed successfully!"
    print_status "You can now use the commands from anywhere in your terminal."
}

# Main script logic
install_binaries

