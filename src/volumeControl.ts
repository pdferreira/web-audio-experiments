///<amd-module name='volumeControl'/>

import * as audioGraph from "./audioGraph";

function bindAudioParamToInputById(param: AudioParam, inputId: string) {
	const input = document.getElementById(inputId) as HTMLInputElement;
	audioGraph.bindAudioParamToInput(param, input);
}

export function setup() {
	bindAudioParamToInputById(audioGraph.gainNodeL.gain, 'volumeL');
	bindAudioParamToInputById(audioGraph.gainNodeR.gain, 'volumeR');
	bindAudioParamToInputById(audioGraph.pannerNode.pan, 'panner');
}
