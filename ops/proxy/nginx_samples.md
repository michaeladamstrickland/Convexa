# Nginx Configuration Samples for IP Allowlist and Basic Authentication

These Nginx configuration snippets demonstrate how to implement IP allowlisting and basic authentication for a web service. These can be integrated into your Nginx server blocks to enhance security.

## 1. IP Allowlist Configuration

This configuration restricts access to a specific location or server block to a predefined set of IP addresses. All other IP addresses will receive a 403 Forbidden error.

```nginx
server {
    listen 80;
    server_name your_domain.com;

    # Allow access only from specific IP addresses
    allow 192.168.1.1/24;  # Example: Allow a specific subnet
    allow 203.0.113.42;    # Example: Allow a single IP address
    deny all;              # Deny all other IP addresses

    location / {
        # Your application's proxy pass or root directory
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Example for a specific path
    location /admin {
        allow 192.168.1.100; # Only allow this IP for /admin
        deny all;
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
    }
}
```

**Explanation:**
*   `allow`: Specifies an IP address or network that is permitted to access.
*   `deny`: Specifies an IP address or network that is forbidden to access.
*   `deny all`: Denies access to all clients not explicitly allowed.

## 2. Basic Authentication Configuration

This configuration requires users to provide a username and password to access a protected resource. The credentials are stored in a `.htpasswd` file.

**Step 1: Create a `.htpasswd` file**

You'll need to install `apache2-utils` (or `httpd-tools` on some systems) to use the `htpasswd` command.

```bash
# Install on Debian/Ubuntu
sudo apt-get update
sudo apt-get install apache2-utils

# Install on CentOS/RHEL
sudo yum install httpd-tools
```

Then, create the `.htpasswd` file and add a user:

```bash
# Create the file and add the first user (e.g., 'admin')
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Add additional users (omit -c to append)
sudo htpasswd /etc/nginx/.htpasswd anotheruser
```
You will be prompted to enter a password for each user.

**Step 2: Configure Nginx**

```nginx
server {
    listen 80;
    server_name your_domain.com;

    location /protected {
        auth_basic "Restricted Area"; # Message displayed in the authentication dialog
        auth_basic_user_file /etc/nginx/.htpasswd; # Path to your .htpasswd file

        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        # Publicly accessible content
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
    }
}
```

**Explanation:**
*   `auth_basic`: Enables basic authentication and sets the realm message.
*   `auth_basic_user_file`: Specifies the path to the file containing usernames and encrypted passwords.

## 3. Combined IP Allowlist and Basic Authentication

You can combine both methods for an even more secure setup. In this case, the IP allowlist is checked first, and then basic authentication is applied to the allowed IPs.

```nginx
server {
    listen 80;
    server_name your_domain.com;

    location /secure-admin {
        # IP Allowlist (checked first)
        allow 192.168.1.1/24;
        allow 203.0.113.42;
        deny all;

        # Basic Authentication (applied to allowed IPs)
        auth_basic "Admin Login Required";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        # Publicly accessible content
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
    }
}
