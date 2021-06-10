///<amd-module name='audioGraph'/>

const audioContext = new AudioContext();

export const gainNodeL = audioContext.createGain();
export const gainNodeR = audioContext.createGain();
export const pannerNode = new StereoPannerNode(audioContext, { pan: 0 });
export const splitNode = audioContext.createChannelSplitter(2);
export const mergeLRNode = audioContext.createChannelMerger(2);
export const analyserNode = audioContext.createAnalyser();
export const frequencyFilterNode = audioContext.createBiquadFilter();
export const originalAnalyserNode = audioContext.createAnalyser();

splitNode
    .connect(gainNodeL, /*L*/0)
    .connect(mergeLRNode, 0, /*L*/0);

splitNode
    .connect(gainNodeR, /*R*/1)
    .connect(mergeLRNode, 0, /*R*/1);

mergeLRNode
    .connect(pannerNode)
    .connect(audioContext.destination);

// Using an audio track as source

var track: MediaElementAudioSourceNode;

export function setTrackAsSource(sourceAudioElem: HTMLAudioElement) {
    if (audioContext.state == 'suspended') {
        audioContext.resume();
    }

    if (track) {
        if (track.mediaElement != sourceAudioElem) {
            // For some reason (chrome bug?) it's not possible to call `createMediaElementSource` twice
            // on the same element, so let's enforce that it's always the same one
            throw new Error("Track already initialized with a different element");
        }
    } else {
        track = audioContext.createMediaElementSource(sourceAudioElem);
    }

    track.connect(originalAnalyserNode);
    track.connect(splitNode);

    pannerNode.connect(analyserNode);
}

export function unsetTrackSource() {
    track.disconnect(originalAnalyserNode);
    track.disconnect(splitNode);

    pannerNode.disconnect(analyserNode);
}

// Applying filters

export function activateFilter() {
    track.disconnect(splitNode);
    track.connect(frequencyFilterNode).connect(splitNode);
}

export function deactivateFilter() {
    track.disconnect(frequencyFilterNode);
    frequencyFilterNode.disconnect(splitNode);
    track.connect(splitNode);
}

// Using a recorded stream as source

var recordingSource: MediaStreamAudioSourceNode | null = null;

function setRecordingAsSource(recordingStream: MediaStream) {
    recordingSource = audioContext.createMediaStreamSource(recordingStream);
    recordingSource.connect(analyserNode);
    
    if (audioContext.state == 'suspended') {
        audioContext.resume();
    }
}

function unsetRecordingSource() {
    recordingSource!.mediaStream.getAudioTracks().forEach(track => track.stop());
    recordingSource!.disconnect(analyserNode);
    recordingSource = null;
}

export async function toggleRecordingSource(): Promise<{ isRecording: boolean }> {
    if (recordingSource) {
        unsetRecordingSource();
        return { isRecording: false };
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setRecordingAsSource(stream);
        return { isRecording: true };
    }
}

export function bindAudioParamToInput(param: AudioParam, input: HTMLInputElement) {
    // bind param to input
    input.addEventListener('input', function() {
        param.value = parseFloat(this.value);
    }, false);

    // initialize with current input value if any
    var initialValue = parseFloat(input.value);
    if (!isNaN(initialValue)) {
        param.value = initialValue;
    }
}