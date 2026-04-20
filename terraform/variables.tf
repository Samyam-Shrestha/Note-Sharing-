variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "active_environment" {
  description = "The active environment (blue or green)"
  default     = "blue"
}

variable "ami_id" {
  description = "AMI ID for Ubuntu 22.04 LTS"
  default     = "ami-0c7217cdde317cfec" # Example AMI ID for Ubuntu 22.04 LTS in us-east-1
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t2.micro"
}

variable "key_name" {
  description = "SSH key pair name"
  default     = "my-key-pair"
}
