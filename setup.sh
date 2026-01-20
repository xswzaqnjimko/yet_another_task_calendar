#!/bin/bash

echo "========================================="
echo "Task Grid - Setup Script"
echo "========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install from: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js found: $(node --version)"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
else
    echo "✅ npm found: $(npm --version)"
fi

# Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed"
    echo "   Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
else
    echo "✅ Rust found: $(rustc --version)"
fi

# Check for Cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo is not installed"
    exit 1
else
    echo "✅ Cargo found: $(cargo --version)"
fi

echo ""
echo "All prerequisites are installed!"
echo ""
echo "Installing npm dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "To run the app in development mode:"
    echo "  npm run tauri:dev"
    echo ""
    echo "To build for production:"
    echo "  npm run tauri:build"
    echo ""
else
    echo ""
    echo "❌ npm install failed. Please check the errors above."
    exit 1
fi
