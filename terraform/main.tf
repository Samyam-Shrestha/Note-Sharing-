terraform {
  required_version = ">= 1.5.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

locals {
  upstream_config_by_env = {
    blue  = <<-EOT
      upstream active_backend {
        server backend_blue:4000;
      }

      upstream active_frontend {
        server frontend_blue:80;
      }
    EOT
    green = <<-EOT
      upstream active_backend {
        server backend_green:4000;
      }

      upstream active_frontend {
        server frontend_green:80;
      }
    EOT
  }

  upstream_config = local.upstream_config_by_env[var.active_environment]
}

resource "local_file" "nginx_active_upstream" {
  filename        = "${path.module}/../ansible/nginx/active-upstream.conf"
  file_permission = "0644"
  content         = trimspace(local.upstream_config)
}
