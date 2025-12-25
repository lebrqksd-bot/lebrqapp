# Create & Push Git Repository - Quick Guide

## Step 1: Initialize Git Repository (Local)

```powershell
# Navigate to your project
cd c:\Users\HP\Desktop\LebrqApp

# Initialize git
git init

# Verify
git status
```

**Expected output:**
```
On branch master

No commits yet

Changes to be tracked:
  (use "git add <file>..." to include in what will be committed)
```

---

## Step 2: Configure Git User (First Time Only)

```powershell
# Set your name
git config --global user.name "Your Name"

# Set your email
git config --global user.email "your.email@example.com"

# Verify
git config --global user.name
git config --global user.email
```

---

## Step 3: Add Files to Git

```powershell
# Add all files (respects .gitignore)
git add .

# Verify what will be committed
git status

# Expected: Shows all files except those in .gitignore
```

---

## Step 4: Create Initial Commit

```powershell
# Commit with a message
git commit -m "Initial commit: LeBRQ frontend and backend with Netlify deployment configuration"

# Verify
git log
```

**Expected output:**
```
[master (root-commit) abc1234] Initial commit: LeBRQ frontend and backend
 XXX files changed, XXXXX insertions(+)
```

---

## Step 5: Create GitHub Repository

### Option A: Using GitHub Web UI (Recommended)

1. Go to https://github.com/new
2. **Repository name:** `lebrqapp` (or your preferred name)
3. **Description:** "LeBRQ - Event Management Platform with Expo/React Native"
4. **Public** or **Private** - choose based on your preference
5. **Don't** initialize with README/gitignore (we already have these)
6. Click **"Create repository"**
7. GitHub will show you commands to run

### Option B: GitHub CLI (Faster)

```powershell
# Install GitHub CLI first (if not already installed)
# From https://cli.github.com/

# Login to GitHub
gh auth login
# Follow prompts

# Create repository
gh repo create lebrqapp `
  --source=. `
  --remote=origin `
  --push `
  --public
```

---

## Step 6: Add Remote Repository & Push

If you created repo on GitHub Web UI, run these commands:

```powershell
# Copy the URL from GitHub (looks like: https://github.com/your-username/lebrqapp.git)
# Then run:

# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/lebrqapp.git

# Verify remote
git remote -v
# Should show:
# origin  https://github.com/YOUR_USERNAME/lebrqapp.git (fetch)
# origin  https://github.com/YOUR_USERNAME/lebrqapp.git (push)

# Rename branch (if needed)
git branch -M main

# Push to GitHub
git push -u origin main

# Verify
git log --oneline
```

---

## Step 7: Verify on GitHub

1. Go to your GitHub repository: https://github.com/YOUR_USERNAME/lebrqapp
2. You should see:
   - All your project files
   - Commit history
   - `.env` and secrets are NOT shown (✓ gitignore working)
   - `.venv/` is NOT shown (✓ gitignore working)
   - `node_modules/` is NOT shown (✓ gitignore working)

---

## Step 8: Connect to Netlify

1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub** (or your Git provider)
4. Authorize and select `lebrqapp` repository
5. Build settings auto-detected from `netlify.toml`
6. Click **"Deploy site"**

---

## Quick Commands Reference

```powershell
# Check git status
git status

# View commit history
git log --oneline

# See changes
git diff

# Add all changes
git add .

# Commit
git commit -m "Your message"

# Push to remote
git push

# Pull latest changes
git pull

# Create new branch
git checkout -b feature-name

# Switch branch
git checkout main

# View remotes
git remote -v

# Change remote URL
git remote set-url origin https://github.com/your-username/lebrqapp.git
```

---

## Common Issues & Solutions

### Issue: "fatal: not a git repository"

**Solution:** You're not in the right folder
```powershell
cd c:\Users\HP\Desktop\LebrqApp
git init
```

### Issue: "Please tell me who you are"

**Solution:** Configure git user
```powershell
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Issue: "fatal: 'origin' does not appear to be a 'git' repository"

**Solution:** Remote not configured
```powershell
# List remotes
git remote -v

# Add remote if missing
git remote add origin https://github.com/YOUR_USERNAME/lebrqapp.git
```

### Issue: "refused to merge unrelated histories"

**Solution:** Pull with allow-unrelated-histories flag
```powershell
git pull origin main --allow-unrelated-histories
```

### Issue: "Everything up-to-date" but files not showing on GitHub

**Solution:** Push with -u flag
```powershell
git push -u origin main
```

---

## Git Workflow (Going Forward)

```
Make changes to files
    ↓
git add .
    ↓
git commit -m "Description of changes"
    ↓
git push
    ↓
Changes appear on GitHub
    ↓
Netlify auto-deploys (if connected)
```

---

## Security Checklist

- ✅ `.gitignore` ignores `.env` files
- ✅ `.gitignore` ignores `node_modules/`
- ✅ `.gitignore` ignores `.venv/`
- ✅ `.gitignore` ignores `*.db` files
- ✅ No secrets in committed files
- ✅ `.env.example` is in git (template)
- ✅ Passwords not in git history
- ✅ API keys not in git history

---

## What Should Be in Git

✅ Source code
✅ Configuration files (netlify.toml, app.json, etc.)
✅ Documentation (README.md, guides, etc.)
✅ .env.example (template only)
✅ package.json (not node_modules/)
✅ .gitignore (this file)
✅ .github/ folder (GitHub workflows, etc.)

## What Should NOT Be in Git

❌ .env (actual secrets)
❌ node_modules/ (installed packages)
❌ .venv/ (Python virtual environment)
❌ dist/ (build output)
❌ .DS_Store (macOS files)
❌ Thumbs.db (Windows files)
❌ *.log (log files)
❌ *.db (database files)

---

## Next Steps

1. ✅ Initialize git: `git init`
2. ✅ Add files: `git add .`
3. ✅ Commit: `git commit -m "Initial commit"`
4. ✅ Create GitHub repository
5. ✅ Add remote: `git remote add origin https://...`
6. ✅ Push: `git push -u origin main`
7. ⏭ Connect to Netlify
8. ⏭ Set environment variables
9. ⏭ Deploy!

---

## Useful Links

- [GitHub Documentation](https://docs.github.com)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub CLI](https://cli.github.com/)
- [Netlify Documentation](https://docs.netlify.com)
- [GitHub & Netlify Integration](https://docs.netlify.com/site-deploys/create-deploys/#deploy-from-a-git-repository)

---

## Support

Having issues? Common problems:

1. **Git not installed?** Download from https://git-scm.com
2. **GitHub account?** Create at https://github.com/signup
3. **Need help?** See troubleshooting section above

---

**Ready to deploy to Netlify?** Your repository is now ready! 🚀
