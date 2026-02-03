# Git Commands - Backup to GitHub

## Các bước để đưa code lên GitHub

### Bước 1: Kiểm tra trạng thái hiện tại
```bash
git status
```

### Bước 2: Thêm tất cả các files mới và thay đổi
```bash
# Thêm tất cả files
git add .

# Hoặc thêm từng file cụ thể
git add src/
git add angular.json
git add package.json
git add package-lock.json
git add tailwind.config.js
git add postcss.config.js
git add .gitignore
git add SETUP.md
```

### Bước 3: Xem các files sẽ được commit
```bash
git status
```

### Bước 4: Commit các thay đổi
```bash
git commit -m "feat: Add Firebase authentication, project management features, and Tailwind CSS

- Integrate Firebase Authentication with Google provider
- Add Kanban board with drag-and-drop functionality
- Implement task and subtask management
- Add global timer for time tracking
- Create admin panel for user management
- Configure Tailwind CSS for styling
- Add route guards (auth and admin)
- Setup environment files for Firebase config
- Add comprehensive documentation"
```

### Bước 5: Kiểm tra remote repository
```bash
# Xem remote hiện tại
git remote -v

# Nếu chưa có remote, thêm remote GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Hoặc với SSH
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

### Bước 6: Push lên GitHub
```bash
# Push lên branch main
git push -u origin main

# Hoặc nếu gặp lỗi, force push (chỉ lần đầu)
git push -u origin main --force
```

## Các lệnh hữu ích khác

### Xem lịch sử commit
```bash
git log --oneline
git log --graph --oneline --all
```

### Xem thay đổi trước khi commit
```bash
# Xem tất cả thay đổi
git diff

# Xem thay đổi của file cụ thể
git diff src/app/app.component.ts
```

### Hủy thay đổi (nếu cần)
```bash
# Hủy thay đổi của 1 file chưa add
git restore <file>

# Hủy staging của 1 file đã add
git restore --staged <file>

# Hủy commit cuối cùng (giữ lại thay đổi)
git reset --soft HEAD~1
```

### Tạo branch mới
```bash
# Tạo và chuyển sang branch mới
git checkout -b feature/new-feature

# Push branch mới lên GitHub
git push -u origin feature/new-feature
```

## Checklist trước khi push

- [ ] Đã tạo và cấu hình environment files
- [ ] Kiểm tra .gitignore đã đúng (không commit environment.ts, environment.prod.ts)
- [ ] Test app chạy được: `npm start`
- [ ] Build production thành công: `npm run build`
- [ ] Đã commit với message rõ ràng
- [ ] Đã có README.md hoặc SETUP.md hướng dẫn

## Lưu ý quan trọng ⚠️

1. **KHÔNG BAO GIỜ commit các file sau:**
   - `src/environments/environment.ts`
   - `src/environments/environment.prod.ts`
   - `.firebaserc`
   - `firebase.json` (nếu chứa thông tin nhạy cảm)

2. **Luôn check trước khi commit:**
   ```bash
   git status
   git diff
   ```

3. **Nếu đã commit nhầm file nhạy cảm:**
   ```bash
   # Xóa file khỏi staging
   git rm --cached src/environments/environment.ts
   
   # Commit lại
   git commit --amend
   
   # Force push (cẩn thận!)
   git push --force
   ```

## Quick Commands - Sao chép và chạy

```bash
# === QUICK START ===

# 1. Add all changes
git add .

# 2. Commit
git commit -m "feat: Add project management features with Firebase and Tailwind CSS"

# 3. Add remote (nếu chưa có)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 4. Push to GitHub
git push -u origin main
```
