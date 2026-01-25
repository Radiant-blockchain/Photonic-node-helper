# Build context expects a Linux (amd64) aviand binary at ./aviand
# (i.e. this file's folder contains a file named "aviand")

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 \
  && rm -rf /var/lib/apt/lists/*

# Copy local binary into the image
COPY ./aviand /usr/local/bin/aviand
RUN chmod +x /usr/local/bin/aviand

# Data dir mount point
VOLUME ["/data"]

# P2P + RPC (match your compose)
EXPOSE 7895 8766

ENTRYPOINT ["/usr/local/bin/aviand"]
