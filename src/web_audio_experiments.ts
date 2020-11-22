///<amd-module name='web_audio_experiments'/>

import { FrequencyBarChart, WaveformChart, IAnimatedChart } from "./charts";
import * as audioGraph from "./audioGraph";

const audioElem = document.querySelector('audio') as HTMLAudioElement;
const playButton = document.getElementById('playBtn') as HTMLButtonElement;

function bindAudioParamToInput(param: AudioParam, input: HTMLInputElement) {
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

function bindAudioParamToInputById(param: AudioParam, inputId: string) {
	const input = document.getElementById(inputId) as HTMLInputElement;
	bindAudioParamToInput(param, input);
}

bindAudioParamToInputById(audioGraph.gainNodeL.gain, 'volumeL');
bindAudioParamToInputById(audioGraph.gainNodeR.gain, 'volumeR');
bindAudioParamToInputById(audioGraph.pannerNode.pan, 'panner');

const filterTypeElem = document.getElementById('filterType') as HTMLSelectElement;
const filterFrequencyElem = document.getElementById('filterFrequency') as HTMLInputElement;
const filterDetuneElem = document.getElementById('filterDetune') as HTMLInputElement;
const filterQualityElem = document.getElementById('filterQuality') as HTMLInputElement;
const filterGainElem = document.getElementById('filterGain') as HTMLInputElement;


bindAudioParamToInput(audioGraph.frequencyFilterNode.frequency, filterFrequencyElem);
bindAudioParamToInput(audioGraph.frequencyFilterNode.detune, filterDetuneElem);
bindAudioParamToInput(audioGraph.frequencyFilterNode.Q, filterQualityElem);
bindAudioParamToInput(audioGraph.frequencyFilterNode.gain, filterGainElem);
	
const fftSizeElem = document.getElementById('fftSize') as HTMLInputElement;
audioGraph.analyserNode.fftSize = parseInt(fftSizeElem.value);
audioGraph.originalAnalyserNode.fftSize = audioGraph.analyserNode.fftSize;

const maxDrawSamplesElem = document.getElementById('maxDrawSamples') as HTMLInputElement;
const maxDrawLinesElem = document.getElementById('maxDrawLines') as HTMLInputElement;

const waveformCanvasElem = document.getElementById('waveformCanvas') as HTMLCanvasElement;

const frequencyCanvasElem = document.getElementById('frequencyBarCanvas') as HTMLCanvasElement;

const waveformChart = new WaveformChart(waveformCanvasElem, audioGraph.analyserNode, maxDrawLinesElem, maxDrawSamplesElem);

const originalWaveformChart = new WaveformChart(waveformCanvasElem, audioGraph.originalAnalyserNode, maxDrawLinesElem, maxDrawSamplesElem);
originalWaveformChart.options.lineStrokeStyle = () => 'darkgreen';

const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.analyserNode);

const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.originalAnalyserNode);
originalFreqBarChart.options.barFillStyle = (barIdx: number) => 'gray';

const charts: IAnimatedChart[] = [waveformChart, frequencyBarChart];

maxDrawSamplesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

maxDrawLinesElem.addEventListener('input', function() {
	charts.forEach(chart => chart.reset());
});

fftSizeElem.addEventListener('change', function() {
	var currFFTSize = parseInt(this.value);
	const logBase2 = Math.log2(currFFTSize);
	
	if (audioGraph.analyserNode.fftSize < currFFTSize) {
		audioGraph.analyserNode.fftSize = Math.pow(2, Math.ceil(logBase2));
	} else {
		audioGraph.analyserNode.fftSize = Math.pow(2, Math.floor(logBase2));
	}
	audioGraph.originalAnalyserNode.fftSize = audioGraph.analyserNode.fftSize;
	
	charts.forEach(chart => chart.reset());

	this.value = audioGraph.analyserNode.fftSize.toString();
});

const onAudioStopped = () => {
	playButton.dataset.playing = 'false';
	playButton.innerHTML = 'Play';

	charts.forEach(chart => chart.stop());
		
	audioGraph.unsetTrackSource();
};

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

const freqChartScaleElems = document.getElementsByName('freqChartScale') as NodeListOf<HTMLInputElement>;
for (const elem of freqChartScaleElems) {
	elem.addEventListener('input', function () {
		if (this.checked) {
			const useLogScale = this.value === 'log';

			frequencyBarChart.options.logScale = useLogScale;
			frequencyBarChart.options.drawChromaticScale = useLogScale;
			frequencyBarChart.options.scaleX = useLogScale ? Math.pow(2, -7) : 1; // useful default

			originalFreqBarChart.options.logScale = useLogScale;
			originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
		}
	});
	elem.dispatchEvent(new Event('input'));
}

const audioFileElem = <HTMLInputElement> document.getElementById('audioFile');
audioFileElem.addEventListener('change', function() {
	const file = URL.createObjectURL(this.files[0]);
	audioElem.src = file;
	
	if (playButton.dataset.playing === 'true') {
		audioElem.play();
	}
});

const recordBtn = document.getElementById('recordBtn');

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

const zoomInElem = document.getElementById('zoomInBtn');
zoomInElem.addEventListener('click', function () {
	frequencyBarChart.options.scaleX /= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
	originalFreqBarChart.reset();
});

const zoomOutElem = document.getElementById('zoomOutBtn');
zoomOutElem.addEventListener('click', function () {
	frequencyBarChart.options.scaleX *= 2;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = frequencyBarChart.options.scaleX;
	originalFreqBarChart.reset();
});

const zoomResetElem = document.getElementById('zoomResetBtn');
zoomResetElem.addEventListener('click', function () {
	frequencyBarChart.options.scaleX = 1;
	frequencyBarChart.reset();

	originalFreqBarChart.options.scaleX = 1;
	originalFreqBarChart.reset();
});

filterTypeElem.addEventListener('change', function() {
	if (filterTypeElem.value === '' && this.dataset.filtering == 'true') {
		audioGraph.deactivateFilter();

		filterFrequencyElem.parentElement.classList.add('hidden');
		filterDetuneElem.parentElement.classList.add('hidden');
		filterQualityElem.parentElement.classList.add('hidden');
		filterGainElem.parentElement.classList.add('hidden');

		// remove original data charts
		charts.splice(0, /*deleteCount*/2).forEach(chart => chart.stop());

		// re-setup regular chart options
		waveformChart.options.clearCanvas = true;
		frequencyBarChart.options.drawLabels = true;
		frequencyBarChart.options.clearCanvas = true;
		
		this.dataset.filtering = false.toString();
	} else {
		audioGraph.frequencyFilterNode.type = filterTypeElem.value as BiquadFilterType;

		if (this.dataset.filtering == 'false') {
			filterFrequencyElem.value = audioGraph.frequencyFilterNode.frequency.value.toString();
			filterDetuneElem.value = audioGraph.frequencyFilterNode.detune.value.toString();
			filterQualityElem.value = audioGraph.frequencyFilterNode.Q.value.toString();
			filterGainElem.value = audioGraph.frequencyFilterNode.gain.value.toString();	

			audioGraph.activateFilter();

			filterFrequencyElem.parentElement.classList.remove('hidden');
			filterDetuneElem.parentElement.classList.remove('hidden');

			var chartsWereActive = charts.some(c => c.isActive);
			
			// add original data charts
			// regular charts need to be reset as well, so both are in sync in terms of drawing
			charts.forEach(chart => chart.stop());
			charts.unshift(originalWaveformChart, originalFreqBarChart);

			// re-setup regular chart options
			waveformChart.options.clearCanvas = false;
			frequencyBarChart.options.drawLabels = false;
			frequencyBarChart.options.clearCanvas = false;

			if (chartsWereActive) {
				charts.forEach(chart => chart.start());
			}
			
			this.dataset.filtering = true.toString();
		}

		if (['lowshelf', 'highshelf'].indexOf(filterTypeElem.value) >= 0) {
			filterQualityElem.parentElement.classList.add('hidden');
		} else {
			filterQualityElem.parentElement.classList.remove('hidden');
		}

		if (['lowshelf', 'highshelf', 'peaking'].indexOf(filterTypeElem.value) >= 0) {
			filterGainElem.parentElement.classList.remove('hidden');
		} else {
			filterGainElem.parentElement.classList.add('hidden');
		}
	} 
});