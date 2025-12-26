# Push to GitHub - Step by Step

## ✅ You've Already Done This

- ✅ Initialized Git repository (`git init`)
- ✅ Configured git user
- ✅ Added all files (`git add .`)
- ✅ Created initial commit

## Now: Push to GitHub

### Step 1: Create GitHub Repository

Go to **https://github.com/new**

1. **Repository name:** `lebrqapp`
2. **Description:** "LeBRQ - Event Management Platform"
3. **Public** (recommended for Netlify integration)
4. **Don't** initialize with README (we already have files)
5. Click **"Create repository"**

GitHub will show you a screen with commands.

### Step 2: Copy Your Repository URL

After creating, GitHub shows:
```
https://github.com/YOUR_USERNAME/lebrqapp.git
```

Copy this URL - you'll need it next.

### Step 3: Add Remote & Push

Replace `YOUR_USERNAME` with your actual GitHub username:

```powershell
# Navigate to project
cd c:\Users\HP\Desktop\LebrqApp

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/lebrqapp.git

# Verify it was added
git remote -v

# Push to GitHub
git push -u origin master
```

**Expected output:**
```
Enumerating objects: XXX, done.
Counting objects: 100% (XXX/XXX), done.
...
To https://github.com/YOUR_USERNAME/lebrqapp.git
 * [new branch]      master -> master
Branch 'master' set up to track remote branch 'master' from 'origin'.
```

### Step 4: Verify on GitHub

1. Go to **https://github.com/YOUR_USERNAME/lebrqapp**
2. You should see all your files
3. Check files are there:
   - ✅ `app/` folder
   - ✅ `backend/` folder
   - ✅ `netlify.toml`
   - ✅ `.env.example` (but NOT `.env`)
   - ✅ All documentation files

---

## Quick Command Reference

```powershell
# One-time setup
git remote add origin https://github.com/YOUR_USERNAME/lebrqapp.git

# View remotes
git remote -v

# Push code to GitHub
git push -u origin master

# Future pushes (after making changes)
git add .
git commit -m "Description of changes"
git push

# Check status
git status
```

---

## Next: Connect to Netlify

Once code is on GitHub:

1. Go to **https://app.netlify.com**
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub**
4. Choose `lebrqapp` repository
5. Netlify auto-detects `netlify.toml` settings
6. Click **"Deploy"**

That's it! Netlify will:
- ✅ Clone your repo
- ✅ Run `npm run export:web`
- ✅ Deploy to CDN
- ✅ Watch for changes and auto-deploy

---

## Troubleshooting

### Error: "fatal: 'origin' does not appear to be a 'git' repository"

This means you haven't set the remote yet.

**Solution:**
```powershell
# Add remote
git remote add origin https://github.com/YOUR_USERNAME/lebrqapp.git

# Push
git push -u origin master
```

### Error: "fatal: The current branch master has no upstream branch"

**Solution:**
```powershell
git push -u origin master
```

The `-u` flag sets up tracking.

### Error: "permission denied"

**Solution:**
- Use HTTPS URL (not SSH) - recommended for beginners
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### Error: "authentication failed"

**Solution:**
1. Use personal access token instead of password
2. Create token: https://github.com/settings/tokens
3. Use token as password when prompted

---

## What Gets Pushed to GitHub

✅ **Should be there:**
- Source code
- Configuration files
- Documentation
- `.env.example` (template)
- `.gitignore` (security)

❌ **Should NOT be there:**
- `.env` (actual secrets)
- `node_modules/` (installed packages)
- `.venv/` (Python virtual env)
- `dist/` (build output)
- `*.log` (log files)
- `*.db` (database files)

---

## Workflow from Now On

```
1. Make changes to files
2. git add .
3. git commit -m "Your message"
4. git push
5. Changes appear on GitHub
6. Netlify automatically deploys
```

---

## Complete Setup Flow

```
✅ Local Repository (Done)
    ↓
→ Create GitHub Repository (Next - do on GitHub.com)
    ↓
→ Add Remote (git remote add origin ...)
    ↓
→ Push to GitHub (git push -u origin master)
    ↓
→ Connect to Netlify (in Netlify UI)
    ↓
→ Set Environment Variables (in Netlify UI)
    ↓
→ Deploy! (Netlify auto-builds)
```

---

**You're ready to go live!** 🚀

Next: Go to GitHub.com and create the repository!
