output "active_environment" {
  description = "Active environment currently selected for Nginx routing"
  value       = var.active_environment
}

output "nginx_active_upstream_file" {
  description = "Rendered Nginx upstream file path"
  value       = local_file.nginx_active_upstream.filename
}
