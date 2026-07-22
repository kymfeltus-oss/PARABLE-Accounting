type AuthErrorLike = {
  message: string;
};

export function getAuthErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error?.message) {
    return "Unable to complete the request. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Email confirmation is required before signing in.";
  }

  if (message.includes("user already registered")) {
    return "An account with this email already exists.";
  }

  if (message.includes("password should be at least")) {
    return "Password does not meet the minimum requirements.";
  }

  if (message.includes("unable to validate email address")) {
    return "Enter a valid email address.";
  }

  if (message.includes("signup is disabled")) {
    return "Account creation is not available right now.";
  }

  return "Unable to complete the request. Please try again.";
}
