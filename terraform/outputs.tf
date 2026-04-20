output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "blue_instance_ip" {
  description = "Public IP of the Blue instance"
  value       = aws_instance.blue.public_ip
}

output "green_instance_ip" {
  description = "Public IP of the Green instance"
  value       = aws_instance.green.public_ip
}
