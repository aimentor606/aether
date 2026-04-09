sudo certbot certonly \
  --dns-aliyun \
  --dns-aliyun-credentials /root/.aliyun.ini \
  -d aimentor.top \
  -d www.aimentor.top \
  --email aimentor606@gmail.com \
  --agree-tos \
  --non-interactive \
  --cert-name www.aimentor.top \
  -v
