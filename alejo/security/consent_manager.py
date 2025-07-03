# Consent Manager module for ALEJO

class ConsentManager:
    def __init__(self):
        # Dictionary to store consent status per user
        # True indicates that the user has granted consent, False otherwise
        self.user_consents = {}

    def grant_consent(self, user):
        """Grant consent for the specified user."""
        self.user_consents[user] = True
        return True

    def revoke_consent(self, user):
        """Revoke consent for the specified user."""
        self.user_consents[user] = False
        return False

    def has_consent(self, user):
        """Check if the specified user has granted consent."""
        return self.user_consents.get(user, False)

# Example usage
if __name__ == '__main__':
    cm = ConsentManager()
    user = 'alice'
    print(f"Initial consent for {user}: {cm.has_consent(user)}")   # Expected False
    cm.grant_consent(user)
    print(f"After granting, consent for {user}: {cm.has_consent(user)}")  # Expected True
    cm.revoke_consent(user)
    print(f"After revoking, consent for {user}: {cm.has_consent(user)}")  # Expected False
