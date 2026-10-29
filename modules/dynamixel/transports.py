"""Plugin-owned port adapters; all packet encoding/parsing stays in public SDK.

Extended rates are passed to pyserial without modifying the vendored SDK.
Driver rejection propagates before any device register write. A CDC logical
baud never establishes the downstream bridge's physical channel rate.
"""

import select, socket, time
from urllib.parse import urlparse

HOST_BAUDS = {
    9600,
    19200,
    38400,
    57600,
    115200,
    230400,
    460800,
    500000,
    576000,
    921600,
    1000000,
    1152000,
    2000000,
    2500000,
    3000000,
    3500000,
    4000000,
    4500000,
    6000000,
    10500000,
}


def port_class(api, endpoint):
    if not endpoint.startswith(("tcp://", "udp://")):

        class SerialPort(api.PortHandler):
            def getCFlagBaud(self, baudrate):
                return baudrate if type(baudrate) is int and baudrate in HOST_BAUDS else -1

            def setupPort(self, baud):
                try:
                    return super().setupPort(baud)
                except Exception:
                    if getattr(self, "ser", None) is not None:
                        self.ser.close()
                    self.is_open = False
                    raise

        return SerialPort

    class SocketPort(api.PortHandler):
        def __init__(self, name):
            super().__init__(name)
            self.sock = None
            self.buffer = bytearray()

        def getCFlagBaud(self, baud):
            return baud if type(baud) is int and baud in HOST_BAUDS else -1

        def setupPort(self, baud):
            u = urlparse(self.port_name)
            if (
                u.scheme not in ["tcp", "udp"]
                or not u.hostname
                or not u.port
                or u.username
                or u.password
                or u.path not in ["", "/"]
                or u.query
                or u.fragment
            ):
                raise ValueError("Explicit tcp://host:port or udp://host:port required")
            self.closePort()
            self.sock = socket.socket(
                socket.AF_INET6 if ":" in u.hostname else socket.AF_INET,
                socket.SOCK_STREAM if u.scheme == "tcp" else socket.SOCK_DGRAM,
            )
            try:
                self.sock.settimeout(0.5)
                self.sock.connect((u.hostname, u.port))
                self.sock.setblocking(False)
                self.is_open = True
                self.tx_time_per_byte = 10000.0 / self.baudrate
                return True
            except Exception:
                self.closePort()
                raise

        def closePort(self):
            if self.sock is not None:
                self.sock.close()
            self.sock = None
            self.is_open = False
            self.buffer.clear()

        def getBytesAvailable(self):
            self._receive()
            return len(self.buffer)

        def _receive(self):
            if self.sock is None:
                raise RuntimeError("Bridge socket closed")
            for _ in range(16):
                try:
                    data = self.sock.recv(65536)
                    if not data and self.sock.type == socket.SOCK_STREAM:
                        if self.buffer:
                            break
                        raise RuntimeError("Bridge connection closed")
                    self.buffer.extend(data)
                    if len(self.buffer) > 65536:
                        raise RuntimeError("Bridge receive buffer exceeds bound")
                except BlockingIOError:
                    break

        def readPort(self, length):
            self._receive()
            data = self.buffer[:length]
            del self.buffer[:length]
            return bytes(data)

        def writePort(self, packet):
            data = bytes(packet)
            deadline = time.monotonic() + 0.5
            sent = 0
            while sent < len(data):
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([], [self.sock], [], remaining)[1]:
                    raise TimeoutError("Bridge send timeout")
                try:
                    count = self.sock.send(data[sent:])
                except BlockingIOError:
                    continue
                if count <= 0:
                    raise RuntimeError("Bridge send closed")
                sent += count
                if self.sock.type == socket.SOCK_DGRAM and sent != len(data):
                    raise RuntimeError("Partial UDP datagram")
            return sent

        def clearPort(self):
            self._receive()
            self.buffer.clear()

    return SocketPort
