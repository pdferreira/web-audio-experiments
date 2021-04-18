///<amd-module name='main'/>

import { FrequencyBarChart, WaveformChart, IAnimatedChart } from "./charts";
import * as audioGraph from "./audioGraph";
import * as filterControl from "./filterControl";
import * as playbackControl from "./playbackControl";

function bindAudioParamToInputById(param: AudioParam, inputId: string) {
	const input = document.getElementById(inputId) as HTMLInputElement;
	audioGraph.bindAudioParamToInput(param, input);
}

bindAudioParamToInputById(audioGraph.gainNodeL.gain, 'volumeL');
bindAudioParamToInputById(audioGraph.gainNodeR.gain, 'volumeR');
bindAudioParamToInputById(audioGraph.pannerNode.pan, 'panner');
	
const fftSizeElem = document.getElementById('fftSize') as HTMLInputElement;
audioGraph.analyserNode.fftSize = parseInt(fftSizeElem.value);
audioGraph.originalAnalyserNode.fftSize = audioGraph.analyserNode.fftSize;

const maxDrawSamplesElem = document.getElementById('maxDrawSamples') as HTMLInputElement;
const maxDrawLinesElem = document.getElementById('maxDrawLines') as HTMLInputElement;

const waveformCanvasElem = document.getElementById('waveformCanvas') as HTMLCanvasElement;

const frequencyCanvasElem = document.getElementById('frequencyBarCanvas') as HTMLCanvasElement;

const waveformChart = new WaveformChart(waveformCanvasElem, audioGraph.analyserNode, maxDrawLinesElem, maxDrawSamplesElem);

const originalWaveformChart = new WaveformChart(waveformCanvasElem, audioGraph.originalAnalyserNode, maxDrawLinesElem, maxDrawSamplesElem);
originalWaveformChart.setOptions({
	customLineStrokeStyle: 'darkgreen'
});

export const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.analyserNode);

export const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.originalAnalyserNode);
originalFreqBarChart.setOptions({
	customBarFillStyle: 'gray'
});

const charts: IAnimatedChart[] = [waveformChart, frequencyBarChart];

playbackControl.setup(charts);

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

const freqChartScaleElems = document.getElementsByName('freqChartScale') as NodeListOf<HTMLInputElement>;
for (const elem of freqChartScaleElems) {
	elem.addEventListener('input', function () {
		if (this.checked) {
			const useLogScale = this.value === 'log';

			frequencyBarChart.setOptions({
				logScale: useLogScale,
				drawChromaticScale: useLogScale,
				scaleX: useLogScale ? Math.pow(2, -7) : 1 // useful default
			});
		}
	});
	elem.dispatchEvent(new Event('input'));
}

const zoomInElem = document.getElementById('zoomInBtn')!;
zoomInElem.addEventListener('click', function () {
	frequencyBarChart.updateOptions(opt => ({ scaleX: opt.scaleX / 2 }));
});

const zoomOutElem = document.getElementById('zoomOutBtn')!;
zoomOutElem.addEventListener('click', function () {
	frequencyBarChart.updateOptions(opt => ({ scaleX: opt.scaleX * 2}));
});

const zoomResetElem = document.getElementById('zoomResetBtn')!;
zoomResetElem.addEventListener('click', function () {
	frequencyBarChart.setOptions({ scaleX: 1 });
});

filterControl.setup(
	/*onActivate*/() => {
		// add original data charts
		waveformChart.link(originalWaveformChart);
		frequencyBarChart.link(originalFreqBarChart);

		// re-setup regular chart options
		waveformChart.setOptions({ clearCanvas: false });
		frequencyBarChart.setOptions({ drawLabels: false, clearCanvas: false });
	},
	/*onDeactivate*/() => {
		// remove original data charts
		waveformChart.unlink(originalWaveformChart);
		frequencyBarChart.unlink(originalFreqBarChart);

		// re-setup regular chart options
		waveformChart.setOptions({ clearCanvas: true });
		frequencyBarChart.setOptions({ drawLabels: true, clearCanvas: true });
	}
);
