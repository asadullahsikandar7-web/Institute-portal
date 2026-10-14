#!/bin/bash
# Generates a self-signed HTTPS cert for local multi-device testing —
# covers localhost, 127.0.0.1, and the machine's current LAN IP, since
# camera/microphone access (getUserMedia) requires a secure context, and
# browsers only treat plain "localhost" as secure over HTTP; a LAN IP like
# http://192.168.x.x:5173 does not count, so both the Vite dev server and
# the backend need to actually serve HTTPS for another device to use the
# class-call feature.
#
# Re-run this any time your LAN IP changes (e.g. after reconnecting to
# Wi-Fi) — it always regenerates against whatever IP is current.
#
# The cert is self-signed, so each device's browser will show a one-time
# "this site is not secure" interstitial on first visit — clicking through
# it (Advanced -> Proceed) is expected and still yields a real secure
# context; camera/mic access works normally after that.
set -e
cd "$(dirname "$0")/.."

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
if [ -z "$LAN_IP" ]; then
  echo "Could not detect a LAN IP automatically (no en0/en1 interface up)."
  echo "Pass one explicitly: ./scripts/generate-dev-cert.sh 192.168.x.x"
  LAN_IP="${1:-127.0.0.1}"
fi

mkdir -p certs
echo "Generating dev cert for: localhost, 127.0.0.1, $LAN_IP"

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/dev-key.pem \
  -out certs/dev-cert.pem \
  -days 365 \
  -subj "/CN=acadexa-dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LAN_IP" \
  2>/dev/null

echo "✅  Wrote certs/dev-cert.pem and certs/dev-key.pem"
echo "    Valid for: localhost, 127.0.0.1, $LAN_IP"
