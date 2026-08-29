# What CI needs to know about this environment.
#
# Published rather than written down in a workflow: a project id is generated when the project is
# created, so the only copy that cannot drift is the one the apply that created it publishes.

data "github_repository" "this" {
  full_name = "${module.config.gh_organization_name}/${module.config.project_name}"
}

# The environment a deploy job names to get these values — and where a required reviewer would be
# configured, if production ever wants one.
resource "github_repository_environment" "this" {
  repository  = data.github_repository.this.name
  environment = local.environment
}

resource "github_actions_environment_variable" "gcp_project_id" {
  repository    = data.github_repository.this.name
  environment   = github_repository_environment.this.environment
  variable_name = "GCP_PROJECT_ID"
  value         = local.gcp_project_id
}

# Who may sign in, and as what. Read by the edge, which checks a token against both, and by the web
# app's build, which bakes them into the bundle that asks for one.
resource "github_actions_environment_variable" "google_client_id" {
  repository    = data.github_repository.this.name
  environment   = github_repository_environment.this.environment
  variable_name = "GOOGLE_CLIENT_ID"
  value         = local.google_client_id
}

resource "github_actions_environment_variable" "google_allowed_domain" {
  repository    = data.github_repository.this.name
  environment   = github_repository_environment.this.environment
  variable_name = "GOOGLE_ALLOWED_DOMAIN"
  value         = module.config.organization_domain
}

# Which account the edge calls as, so the rotation workflow knows whose key to mint.
resource "github_actions_environment_variable" "gcp_edge_invoker_sa_email" {
  repository    = data.github_repository.this.name
  environment   = github_repository_environment.this.environment
  variable_name = "GCP_EDGE_INVOKER_SA_EMAIL"
  value         = google_service_account.edge_invoker.email
}
