import logging

logger = logging.getLogger(__name__)

class SkillPluginRegistry:
    """Registry for dynamic skills and plugins."""

    def __init__(self):
        self.plugins = {}

    def register_plugin(self, name: str, plugin):
        """Register a new plugin with the given name."""
        self.plugins[name] = plugin
        logger.info(f"Plugin registered: {name}")

    def get_plugin(self, name: str):
        """Retrieve a registered plugin by name."""
        return self.plugins.get(name)

    def list_plugins(self):
        """Return a list of registered plugin names."""
        return list(self.plugins.keys())
