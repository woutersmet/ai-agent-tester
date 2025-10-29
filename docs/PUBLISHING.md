# 📘 Publishing to GitHub Pages

This guide will help you publish the AI Agent Tester landing page to GitHub Pages.

## 🚀 Quick Setup (5 minutes)

### Step 1: Push to GitHub

If you haven't already, push your code to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Add GitHub Pages landing page"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/ai-agent-tester.git

# Push to GitHub
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/yourusername/ai-agent-tester`

2. Click on **Settings** (top right of the repository page)

3. Scroll down to the **Pages** section in the left sidebar

4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/docs`

5. Click **Save**

6. Wait 1-2 minutes for GitHub to build your site

7. Your site will be live at: `https://yourusername.github.io/ai-agent-tester/`

### Step 3: Update Links in the Landing Page

Update the GitHub links in `docs/index.html` to point to your actual repository:

Replace `yourusername` with your actual GitHub username in these lines:
- Line 237: `<a href="https://github.com/yourusername/ai-agent-tester" class="btn btn-primary">`
- Line 313: `git clone https://github.com/yourusername/ai-agent-tester.git`
- Line 332-334: Footer links

Then commit and push:

```bash
git add docs/index.html
git commit -m "Update GitHub links"
git push
```

## 🎨 Customization Tips

### Update the Logo
The landing page uses `../ai_agent_tester_icon_2.png`. Make sure this path is correct relative to the `docs/` folder.

### Change Colors
Edit the CSS in `docs/index.html`:
- Main gradient: Line 18 (`background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);`)
- Primary color: Search for `#667eea` and replace with your color
- Accent color: Search for `#68d391` and replace with your color

### Add More Screenshots
Add more images to the screenshots section (around line 260-270)

## 🔧 Troubleshooting

### Page Not Loading?
- Make sure you selected `/docs` folder in GitHub Pages settings
- Wait 2-3 minutes after enabling GitHub Pages
- Check that `docs/index.html` exists in your repository

### Images Not Showing?
- Verify image paths are correct relative to the `docs/` folder
- Images should be in the root directory (one level up from `docs/`)
- Use relative paths like `../image.png`

### Custom Domain (Optional)
To use a custom domain:
1. Add a file named `CNAME` in the `docs/` folder
2. Put your domain name in it (e.g., `www.yourdomain.com`)
3. Configure DNS settings with your domain provider
4. Point to GitHub Pages servers

## 📱 Testing Locally

To test the landing page locally before publishing:

```bash
# Navigate to docs folder
cd docs

# Start a simple HTTP server (Python 3)
python3 -m http.server 8000

# Or use Node.js
npx http-server -p 8000

# Open browser to http://localhost:8000
```

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] GitHub Pages enabled in repository settings
- [ ] Source set to `/docs` folder
- [ ] GitHub username updated in all links
- [ ] Images displaying correctly
- [ ] All links working
- [ ] Site accessible at `https://yourusername.github.io/ai-agent-tester/`

## 🎉 You're Done!

Your landing page should now be live! Share the link:
```
https://yourusername.github.io/ai-agent-tester/
```

---

**Need help?** Check the [GitHub Pages documentation](https://docs.github.com/en/pages)

