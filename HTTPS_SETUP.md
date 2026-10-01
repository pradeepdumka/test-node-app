# Enable HTTPS on EC2 with Docker Compose, Nginx, and Certbot

This setup keeps the Node app running in Docker on port `4000`, then uses Nginx on the EC2 host as the public reverse proxy for HTTP and HTTPS.

## Temporary option: HTTPS with EC2 DNS only

If you only have the EC2 hostname, for example:

```text
ec2-16-170-148-240.eu-north-1.compute.amazonaws.com
```

you can enable HTTPS with a self-signed certificate. The browser will show a warning because the certificate is not trusted by a public certificate authority. This is okay for testing, but not for production.

First, make sure Docker is not using host port `80`. Change Compose to:

```yaml
ports:
  - "127.0.0.1:4000:4000"
```

Restart the app:

```bash
docker compose -f docker.compose.dev.yml down
docker compose -f docker.compose.dev.yml up -d
```

Install Nginx:

```bash
sudo apt update
sudo apt install -y nginx
```

Create a self-signed certificate for the EC2 hostname:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/test-app-backend.key \
  -out /etc/nginx/ssl/test-app-backend.crt \
  -subj "/CN=ec2-16-170-148-240.eu-north-1.compute.amazonaws.com"
```

Create the Nginx config:

```bash
sudo nano /etc/nginx/sites-available/test-app-backend
```

Paste this config:

```nginx
server {
    listen 80;
    server_name ec2-16-170-148-240.eu-north-1.compute.amazonaws.com;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ec2-16-170-148-240.eu-north-1.compute.amazonaws.com;

    ssl_certificate /etc/nginx/ssl/test-app-backend.crt;
    ssl_certificate_key /etc/nginx/ssl/test-app-backend.key;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/test-app-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Open this URL:

```text
https://ec2-16-170-148-240.eu-north-1.compute.amazonaws.com
```

Your browser will show a certificate warning. Click the advanced option and continue if this is only for your own testing.

## 1. Point DNS to EC2

In your domain DNS provider, create an `A` record:

```text
Type: A
Name: @ or api
Value: <your-ec2-public-ip>
TTL: Auto or 300
```

Examples:

```text
example.com      -> 16.170.148.240
api.example.com  -> 16.170.148.240
```

Wait until DNS resolves:

```bash
dig +short api.example.com
```

## 2. Open EC2 security group ports

In the EC2 security group, allow:

```text
HTTP   TCP 80   0.0.0.0/0
HTTPS  TCP 443  0.0.0.0/0
SSH    TCP 22   your-ip-only
```

## 3. Change Docker Compose port binding

Nginx needs to use host ports `80` and `443`, so Docker should not publish the app on host port `80`.

Update the backend service ports from:

```yaml
ports:
  - "80:4000"
```

to:

```yaml
ports:
  - "127.0.0.1:4000:4000"
```

Then restart the app:

```bash
docker compose -f docker.compose.dev.yml down
docker compose -f docker.compose.dev.yml up -d
```

Check that the app works locally on the EC2 host:

```bash
curl http://127.0.0.1:4000
```

## 4. Install Nginx and Certbot

On Ubuntu EC2:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Start and enable Nginx:

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 5. Configure Nginx reverse proxy

Create a config file:

```bash
sudo nano /etc/nginx/sites-available/test-app-backend
```

Use this config, replacing `api.example.com` with your real domain:

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/test-app-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP:

```bash
curl http://api.example.com
```

## 6. Generate SSL certificate

Run Certbot:

```bash
sudo certbot --nginx -d api.example.com
```

Choose the redirect option when Certbot asks whether to redirect HTTP to HTTPS.

Test HTTPS:

```bash
curl https://api.example.com
```

## 7. Verify certificate auto-renewal

Certbot usually installs a systemd timer automatically. Test renewal:

```bash
sudo certbot renew --dry-run
```

## 8. Update app host allowlist

The current app checks `req.hostname` against a single allowed host. After switching to your domain, update the app to allow your domain, for example:

```js
const allowedHost = "api.example.com";
```

If you want both the EC2 hostname and your domain to work, use an array:

```js
const allowedHosts = [
  "api.example.com",
  "ec2-16-170-148-240.eu-north-1.compute.amazonaws.com",
];

app.use((req, res, next) => {
  if (!allowedHosts.includes(req.hostname)) {
    return res.status(403).json({
      message: "Access denied",
    });
  }

  next();
});
```

After changing the app, rebuild and restart Docker:

```bash
docker compose -f docker.compose.dev.yml up -d --build
```

## Useful checks

```bash
docker ps
docker logs test-app-backend
sudo nginx -t
sudo systemctl status nginx
sudo certbot certificates
curl -I http://api.example.com
curl -I https://api.example.com
```

## Common problems

- If Nginx fails to start, Docker may still be using host port `80`. Change Docker Compose to `127.0.0.1:4000:4000` and restart Docker.
- If Certbot fails, confirm DNS points to the EC2 public IP and port `80` is open in the security group.
- If HTTPS returns `403`, update the `allowedHost` value in `index.js` to your real domain.
- If the site works on EC2 but not publicly, check the EC2 security group and any domain proxy/CDN settings.
