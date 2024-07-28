import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function Receiver() {
  const [fileInfo, setFileInfo] = useState({});
  const [receivedChunks, setReceivedChunks] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState('');

  const params = new URLSearchParams(window.location.search);
  const offer = decodeURIComponent(params.get('id'));

  useEffect(() => {
    createConnection();
  }, []);

  const createConnection = () => {
    const remoteConnection = new RTCPeerConnection();

    remoteConnection.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      const chunks = [];
      let receivedSize = 0;

      receiveChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const metadata = JSON.parse(event.data);
          setFileInfo(metadata);
          console.log('Received file metadata:', metadata);
        } else if (event.data.byteLength === 0) {
          const receivedBlob = new Blob(chunks, { type: fileInfo.fileType });
          const url = URL.createObjectURL(receivedBlob);
          setDownloadUrl(url);
          console.log('File received successfully');
        } else {
          chunks.push(event.data);
          receivedSize += event.data.byteLength;
          setReceivedChunks([...chunks]); // Update state to reflect received chunks
          console.log(`Received ${receivedSize} bytes`);
        }
      };
    };

    remoteConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', { candidate: event.candidate });
      }
    };

    remoteConnection.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offer
    })).then(() => {
      return remoteConnection.createAnswer();
    }).then((answer) => {
      return remoteConnection.setLocalDescription(answer);
    }).then(() => {
      socket.emit('answer', { answer: remoteConnection.localDescription });
    }).catch(console.error);

    socket.on('candidate', (data) => {
      remoteConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
    });
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileInfo.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div>
      <h2>Receiving file...</h2>
      {downloadUrl && (
        <button onClick={handleDownload}>Download {fileInfo.fileName}</button>
      )}
    </div>
  );
}

export default Receiver;
