#!/bin/bash

# Build all TypeScript files in the projects directory
# This script recursively finds and compiles all .ts files

set -e  # Exit on any error

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Function to build a single project
build_single() {
    local project_name="$1"
    local file="projects/${project_name}.ts"
    
    if [[ ! -f "$file" ]]; then
        print_error "Project file not found: $file"
        exit 1
    fi
    
    if [[ "$file" == "projects/example.ts" ]]; then
        print_error "Cannot build example.ts"
        exit 1
    fi
    
    # Skip pure config files
    if [[ "$file" == *"-config.ts" ]] || [[ "$file" == *"Config.ts" ]]; then
        print_error "Cannot build config file: $file"
        exit 1
    fi
    
    # Create bin directory if it doesn't exist
    mkdir -p bin
    
    print_status "Building: $file"
    
    # Get the relative path without extension for output naming
    relative_path="${file#projects/}"
    output_name="${relative_path%.ts}"
    
    # Build the file directly to bin directory
    bun build --compile --outfile="bin/$output_name" "$file"
    
    # Clean up temporary files
    rm -f .*.bun-build
    
    print_success "Build complete! Binary: bin/$output_name"
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

# Main script logic
case "${1:-build}" in
    "build")
        if [[ -n "$2" ]]; then
            build_single "$2"
        else
            build_all
        fi
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command] [project]"
        echo ""
        echo "Commands:"
        echo "  build [project]  Build all TypeScript files, or single project if specified (default)"
        echo "  help             Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 build         Build all projects"
        echo "  $0 build frg     Build only the frg project"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
