##########################################################################
#
# pgAdmin 4 - PostgreSQL Tools
#
# Copyright (C) 2013 - 2014, The pgAdmin Development Team
# This software is released under the PostgreSQL Licence
#
##########################################################################

"""The main pgAdmin module. This handles the application initialisation tasks,
such as setup of logging, dynamic loading of modules etc."""

import inspect, logging, os
from flask import Flask

# Configuration settings
import config

def create_app(app_name=config.APP_NAME):
    """Create the Flask application, startup logging and dynamically load
    additional modules (blueprints) that are found in this directory."""
    app = Flask(__name__, static_url_path='')
    app.config.from_object(config)

    ##########################################################################
    # Setup logging and log the application startup
    ##########################################################################

    # Add SQL level logging, and set the base logging level
    logging.addLevelName(25, 'SQL')
    app.logger.setLevel(logging.DEBUG)
    app.logger.handlers = []

    # We also need to update the handler on the webserver in order to see request. 
    # Setting the level prevents werkzeug from setting up it's own stream handler
    # thus ensuring all the logging goes through the pgAdmin logger.
    logger = logging.getLogger('werkzeug')
    logger.setLevel(logging.INFO)

    # File logging
    fh = logging.FileHandler(config.LOG_FILE)
    fh.setLevel(config.FILE_LOG_LEVEL)
    fh.setFormatter(logging.Formatter(config.FILE_LOG_FORMAT))
    app.logger.addHandler(fh)
    logger.addHandler(fh)

    # Console logging
    ch = logging.StreamHandler()
    ch.setLevel(config.CONSOLE_LOG_LEVEL)
    ch.setFormatter(logging.Formatter(config.CONSOLE_LOG_FORMAT))
    app.logger.addHandler(ch)
    logger.addHandler(ch)

    # Log the startup
    app.logger.info('################################################################################')
    app.logger.info('Starting %s v%s...', config.APP_NAME, config.APP_VERSION)
    app.logger.info('################################################################################')

    # Register all the modules
    path = os.path.dirname(os.path.realpath(__file__))
    files = os.listdir(path)
    for f in files:
        d = os.path.join(path, f)
        if os.path.isdir(d) and os.path.isfile(os.path.join(d, '__init__.py')):

            if f in config.MODULE_BLACKLIST:
                app.logger.info('Skipping blacklisted module: %s' % f)
                continue

            # Looks like a module, so import it, and register the blueprint if present
            # We rely on the ordering of syspath to ensure we actually get the right
            # module here.
            app.logger.info('Examining potential module: %s' % d)
            module = __import__(f, globals(), locals(), ['views'], -1)
            if hasattr(module.views, 'blueprint'):
                app.logger.info('Registering blueprint module: %s' % f)
                app.register_blueprint(module.views.blueprint)

    app.logger.debug('URL map: %s' % app.url_map)
    
    return app
