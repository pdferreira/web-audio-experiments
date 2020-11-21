///<amd-module name='web_audio_experiments'/>

import { FrequencyBarChart, WaveformChart, IAnimatedChart } from "./charts";

const audioContext = new AudioContext();

const audioElem = document.querySelector('audio') as HTMLAudioElement;
const track = audioContext.createMediaElementSource(audioElem);

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

const gainNodeL = audioContext.createGain();
const gainNodeR = audioContext.createGain();

bindAudioParamToInputById(gainNodeL.gain, 'volumeL');
bindAudioParamToInputById(gainNodeR.gain, 'volumeR');

const pannerNode = new StereoPannerNode(audioContext, { pan: 0 });

bindAudioParamToInputById(pannerNode.pan, 'panner');

const splitNode = audioContext.createChannelSplitter(2);
const mergeLRNode = audioContext.createChannelMerger(2);
const analyserNode = audioContext.createAnalyser();

const filterTypeElem = document.getElementById('filterType') as HTMLSelectElement;
const filterFrequencyElem = document.getElementById('filterFrequency') as HTMLInputElement;
const filterDetuneElem = document.getElementById('filterDetune') as HTMLInputElement;
const filterQualityElem = document.getElementById('filterQuality') as HTMLInputElement;
const filterGainElem = document.getElementById('filterGain') as HTMLInputElement;

const frequencyFilterNode = audioContext.createBiquadFilter();
const originalAnalyserNode = audioContext.createAnalyser();
track.connect(originalAnalyserNode);

bindAudioParamToInput(frequencyFilterNode.frequency, filterFrequencyElem);
bindAudioParamToInput(frequencyFilterNode.detune, filterDetuneElem);
bindAudioParamToInput(frequencyFilterNode.Q, filterQualityElem);
bindAudioParamToInput(frequencyFilterNode.gain, filterGainElem);

track.connect(splitNode);

splitNode
	.connect(gainNodeL, /*L*/0)
	.connect(mergeLRNode, 0, /*L*/0);
	
splitNode
	.connect(gainNodeR, /*R*/1)
	.connect(mergeLRNode, 0, /*R*/1);
	
mergeLRNode
	.connect(pannerNode)
	.connect(audioContext.destination);
	
const fftSizeElem = document.getElementById('fftSize') as HTMLInputElement;
analyserNode.fftSize = parseInt(fftSizeElem.value);
originalAnalyserNode.fftSize = analyserNode.fftSize;


const maxDrawSamplesElem = document.getElementById('maxDrawSamples') as HTMLInputElement;
const maxDrawLinesElem = document.getElementById('maxDrawLines') as HTMLInputElement;

const waveformCanvasElem = document.getElementById('waveformCanvas') as HTMLCanvasElement;

const frequencyCanvasElem = document.getElementById('frequencyBarCanvas') as HTMLCanvasElement;

const waveformChart = new WaveformChart(waveformCanvasElem, analyserNode, maxDrawLinesElem, maxDrawSamplesElem);

const originalWaveformChart = new WaveformChart(waveformCanvasElem, originalAnalyserNode, maxDrawLinesElem, maxDrawSamplesElem);
originalWaveformChart.options.lineStrokeStyle = () => 'darkgreen';

const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, analyserNode);

const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, originalAnalyserNode);
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
	
	if (analyserNode.fftSize < currFFTSize) {
		analyserNode.fftSize = Math.pow(2, Math.ceil(logBase2));
	} else {
		analyserNode.fftSize = Math.pow(2, Math.floor(logBase2));
	}
	originalAnalyserNode.fftSize = analyserNode.fftSize;
	
	charts.forEach(chart => chart.reset());

	this.value = analyserNode.fftSize.toString();
});

const onAudioStopped = () => {
	playButton.dataset.playing = 'false';
	playButton.innerHTML = 'Play';

	charts.forEach(chart => chart.stop());
		
	pannerNode.disconnect(analyserNode);
};

playButton.addEventListener('click', function () {
	if (audioContext.state == 'suspended') {
		audioContext.resume();
	}
	
	if (this.dataset.playing === 'false') {
		audioElem.play();
		this.dataset.playing = 'true';
		
		pannerNode.connect(analyserNode);
		
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
var recordingStream = null;
var recordingSource: MediaStreamAudioSourceNode = null;

recordBtn.addEventListener('click', function() {
	if (recordingSource) {
		recordingSource.mediaStream.getAudioTracks().forEach(function (track) { track.stop(); });
		recordingSource.disconnect(analyserNode);
		recordingSource = null;
		
		charts.forEach(chart => chart.stop());

		recordBtn.innerHTML = 'Record';
	} else {
		navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
			recordingSource = audioContext.createMediaStreamSource(stream);
			recordingSource.connect(analyserNode);
			
			if (audioContext.state == 'suspended') {
				audioContext.resume();
			}
			
			charts.forEach(chart => chart.start());
			
			recordBtn.innerHTML = 'Recording...';
		});
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
		track.disconnect(frequencyFilterNode);
		frequencyFilterNode.disconnect(splitNode);
		track.connect(splitNode);

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
		frequencyFilterNode.type = filterTypeElem.value as BiquadFilterType;

		if (this.dataset.filtering == 'false') {
			filterFrequencyElem.value = frequencyFilterNode.frequency.value.toString();
			filterDetuneElem.value = frequencyFilterNode.detune.value.toString();
			filterQualityElem.value = frequencyFilterNode.Q.value.toString();
			filterGainElem.value = frequencyFilterNode.gain.value.toString();	

			track.disconnect(splitNode);
			track.connect(frequencyFilterNode).connect(splitNode);

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