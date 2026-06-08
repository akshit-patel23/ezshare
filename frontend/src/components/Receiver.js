import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

function Receiver() {
  const [fileInfo, setFileInfo] = useState({});
  const [downloadUrl, setDownloadUrl] = useState('');

  const params = new URLSearchParams(window.location.search);
  const offer = decodeURIComponent(params.get('id'));

  useEffect(() => {
    const socket = io('https://ezshare.onrender.com', {
      transports: ['websocket'] // ✅ important
    });

    const remoteConnection = new RTCPeerConnection();

    remoteConnection.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      const chunks = [];
      let metadata = null;

      receiveChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          metadata = JSON.parse(event.data);
          setFileInfo(metadata);
        } else if (event.data.byteLength === 0) {
          const receivedBlob = new Blob(chunks, { type: metadata.fileType });
          const url = URL.createObjectURL(receivedBlob);
          setDownloadUrl(url);
        } else {
          chunks.push(event.data);
        }
      };
    };

    remoteConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { candidate: event.candidate });
      }
    };

    // ✅ WebRTC flow
    remoteConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offer
    }))
    .then(() => remoteConnection.createAnswer())
    .then(answer => remoteConnection.setLocalDescription(answer))
    .then(() => {
      socket.emit('answer', { answer: remoteConnection.localDescription });
    });

    socket.on('candidate', (data) => {
      remoteConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    return () => {
      socket.disconnect();
    };

  }, [offer]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileInfo.fileName;
    a.click();
  };

  return (
    <div>
      <h2>Receiving file...</h2>
      {downloadUrl && (
        <button onClick={handleDownload}>
          Download {fileInfo.fileName}
        </button>
      )}
    </div>
  );
}

export default Receiver;