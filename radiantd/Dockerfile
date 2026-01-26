# Radiant Core v2.0.0 - Downloads pre-built binary from GitHub releases
# No local binary required - fetches official release automatically

FROM ubuntu:22.04

ARG RADIANT_VERSION=v2.0.0
ARG RADIANT_RELEASE_URL=https://github.com/Radiant-Core/Radiant-Core/releases/download/${RADIANT_VERSION}/radiant-core-linux-x64.tar.gz

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libboost-chrono1.74.0 \
    libboost-filesystem1.74.0 \
    libboost-thread1.74.0 \
    libevent-2.1-7 \
    libevent-pthreads-2.1-7 \
    libssl3 \
    libdb5.3++ \
    libminiupnpc17 \
    libzmq5 \
  && rm -rf /var/lib/apt/lists/*

# Download and extract Radiant Core binaries
RUN curl -fsSL "${RADIANT_RELEASE_URL}" -o /tmp/radiant.tar.gz \
  && tar -xzf /tmp/radiant.tar.gz -C /tmp \
  && mv /tmp/radiant-core-linux-x64/radiantd /usr/local/bin/ \
  && mv /tmp/radiant-core-linux-x64/radiant-cli /usr/local/bin/ \
  && mv /tmp/radiant-core-linux-x64/radiant-tx /usr/local/bin/ \
  && chmod +x /usr/local/bin/radiant* \
  && rm -rf /tmp/radiant*

# Create radiant user
RUN useradd -m -s /bin/bash radiant \
  && mkdir -p /home/radiant/.radiant \
  && chown -R radiant:radiant /home/radiant/.radiant

USER radiant
WORKDIR /home/radiant

# P2P + RPC (mainnet)
EXPOSE 7333 7332

# Default command
ENTRYPOINT ["radiantd"]
CMD ["-server=1", "-txindex=1", "-printtoconsole"]
