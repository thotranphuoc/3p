#!/bin/bash

# Script backup code lên GitHub
# Chạy: bash backup.sh

echo "🚀 Starting backup to GitHub..."
echo ""

# Kiểm tra git status
echo "📊 Current git status:"
git status --short
echo ""

# Hiển thị files sẽ bị ignore
echo "🔒 Protected files (ignored):"
git status --ignored | grep -A 10 "Ignored files" | grep "environment\|firebase"
echo ""

# Xác nhận
read -p "❓ Do you want to continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Backup cancelled."
    exit 1
fi

# Add tất cả files
echo "📝 Adding files..."
git add .
echo "✅ Files added!"
echo ""

# Hiển thị files sẽ commit
echo "📦 Files to be committed:"
git status --short
echo ""

# Nhập commit message
echo "💬 Enter commit message (or press Enter for default):"
read commit_msg

if [ -z "$commit_msg" ]; then
    commit_msg="feat: Update project management features

- Update Firebase configuration
- Improve UI/UX
- Add new features and components
- Update documentation"
fi

# Commit
echo "💾 Committing changes..."
git commit -m "$commit_msg"
echo "✅ Committed!"
echo ""

# Kiểm tra remote
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No remote repository found!"
    echo "Please add remote repository:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
    exit 1
fi

# Push
echo "🚀 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Backup successful!"
    echo "🎉 Your code has been pushed to GitHub!"
else
    echo ""
    echo "❌ Push failed!"
    echo "Please check your remote repository and try again."
    exit 1
fi
