set -e
rm -rf public && mkdir -p public
curl -fsSL https://github.com/ryantheirreal/whilo-swas/releases/download/v1.0.0/whilo-site-v1.0.2.tar.gz -o site.tgz
echo '367032f5e1429ddd5e2e6e6205a6b9827749b60a689b197d36be8f5febcfc05e  site.tgz' | sha256sum -c -
tar xzf site.tgz -C public
rm -f public/vercel.json
# Add the editable enterprise workspace enhancement without replacing the original Whilo shell.
cp whilo-enterprise.js public/whilo-enterprise.js
node -e "const fs=require('node:fs'); const p='public/index.html'; let h=fs.readFileSync(p,'utf8'); const tag='<script src=\"/whilo-enterprise.js\" defer></script>'; if (!h.includes('/whilo-enterprise.js')) { if (!/<\\/body>/i.test(h)) throw new Error('Whilo entry HTML has no closing body tag'); h=h.replace(/<\\/body>/i, tag + '</body>'); } fs.writeFileSync(p,h);"
ls public | head
