set -e
rm -rf public && mkdir -p public
curl -fsSL https://github.com/ryantheirreal/whilo-swas/releases/download/v1.0.0/whilo-site-v1.0.2.tar.gz -o site.tgz
echo '367032f5e1429ddd5e2e6e6205a6b9827749b60a689b197d36be8f5febcfc05e  site.tgz' | sha256sum -c -
tar xzf site.tgz -C public
rm -f public/vercel.json
ls public | head
