export function isBootstrapAdminAvailable(hasConfiguredSecret: boolean, hasExistingAdministrator: boolean) {
  return hasConfiguredSecret && !hasExistingAdministrator;
}
