#!/bin/bash

# Uninstall binaries from /usr/local/bin

set -e  # Exit on any error

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

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
uninstall_binaries

