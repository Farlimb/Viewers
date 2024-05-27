# This dockerfile is used to publish the `ohif/app` image on dockerhub.
#
# It's a good example of how to build our static application and package it
# with a web server capable of hosting it as static content.
#
# docker build
# --------------
# If you would like to use this dockerfile to build and tag an image, make sure
# you set the context to the project's root directory:
# https://docs.docker.com/engine/reference/commandline/build/
#
#
# SUMMARY
# --------------
# This dockerfile has two stages:
#
# 1. Building the React application for production
# 2. Setting up our Apache (Alpine Linux) image w/ step one's output
#

# Stage 1: Build the application
# docker build -t ohif/viewer:latest .
FROM node:18.16.1-slim as json-copier

RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY ["package.json", "yarn.lock", "preinstall.js", "./"]
COPY extensions /usr/src/app/extensions
COPY modes /usr/src/app/modes
COPY platform /usr/src/app/platform

# Copy Files
FROM node:18.16.1-slim as builder
RUN apt-get update && apt-get install -y build-essential python3
RUN mkdir /usr/src/app
WORKDIR /usr/src/app

COPY --from=json-copier /usr/src/app .

# Run the install before copying the rest of the files
RUN yarn config set workspaces-experimental true
RUN yarn install --frozen-lockfile --verbose

COPY . .

# To restore workspaces symlinks
RUN yarn install --frozen-lockfile --verbose

ENV PATH /usr/src/app/node_modules/.bin:$PATH
ENV QUICK_BUILD true

RUN yarn run build

# Stage 3: Bundle the built application into a Docker container
# which runs Apache using Alpine Linux
FROM httpd:2.4-alpine as final

# Environment variable for the port
ENV PORT=80
ENV SSL_PORT=443

# Install gettext for envsubst
RUN apk update && apk add gettext

# Copy application files to the Apache document root
COPY --from=builder /usr/src/app/platform/app/dist /usr/local/apache2/htdocs/

# Copy the entrypoint script and make it executable
COPY .docker/Viewer-v3.x/entrypoint.sh /usr/src/entrypoint.sh
RUN chmod 777 /usr/src/entrypoint.sh

# Copy Apache configuration templates
COPY .docker/Viewer-v3.x/default.conf.template /usr/src/default.conf.template
COPY .docker/Viewer-v3.x/default.ssl.conf.template /usr/src/default.ssl.conf.template

# Ensure the app-config.js is writable
RUN chmod 666 /usr/local/apache2/htdocs/app-config.js

# Expose the port
EXPOSE ${PORT}
EXPOSE ${SSL_PORT}
# Set the entrypoint script
ENTRYPOINT ["/usr/src/entrypoint.sh"]

# Run Apache in the foreground
CMD ["httpd-foreground"]
