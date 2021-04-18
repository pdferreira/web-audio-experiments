///<amd-module name='playbackControl'/>

import { IAnimatedChart } from "./charts";
import * as audioGraph from "./audioGraph";

const audioElem = document.querySelector('audio') as HTMLAudioElement;
const playButton = document.getElementById('playBtn') as HTMLButtonElement;

function setupPlayButton(charts: IAnimatedChart[]) {
	const onAudioStopped = () => {
		playButton.dataset.playing = 'false';
		playButton.innerHTML = 'Play';

		charts.forEach(chart => chart.stop());
		
		audioGraph.unsetTrackSource();
	};

	// Play/Pause button logic
	playButton.addEventListener('click', function () {
		if (this.dataset.playing === 'false') {
			audioElem.play();
			this.dataset.playing = 'true';
		
			audioGraph.setTrackAsSource(audioElem);
		
			charts.forEach(chart => chart.start());
		
			playButton.innerHTML = 'Pause';
		} else if (this.dataset.playing === 'true') {
			audioElem.pause();
			onAudioStopped();
		}
	}, false);

	audioElem.addEventListener('ended', onAudioStopped);
}

function setupFilePicker() {
	const audioFileElem = document.getElementById('audioFile') as HTMLInputElement;
	audioFileElem.addEventListener('change', function () {
		if (this.files == null || this.files.length === 0) {
			return;
		}

		const file = URL.createObjectURL(this.files[0]);
		audioElem.src = file;
	
		if (playButton.dataset.playing === 'true') {
			audioElem.play();
		}
	});
}

function setupRecordButton(charts: IAnimatedChart[]) {
	const recordBtn = document.getElementById('recordBtn')!;

	recordBtn.addEventListener('click', async function () {
		const result = await audioGraph.toggleRecordingSource();
		if (result.isRecording) {
			charts.forEach(chart => chart.start());
			recordBtn.innerHTML = 'Recording...';
		} else {
			charts.forEach(chart => chart.stop());
			recordBtn.innerHTML = 'Record';
		}
	});
}

export function setup(charts: IAnimatedChart[]) {
	setupPlayButton(charts);
	setupRecordButton(charts);
	setupFilePicker();
}