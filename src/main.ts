///<amd-module name='main'/>

import { IAnimatedChart } from "./charts";
import * as audioGraph from "./audioGraph";
import * as filterControl from "./filterControl";
import * as playbackControl from "./playbackControl";
import * as frequencyChartControl from "./frequencyChartControl";
import * as waveformChartControl from "./waveformChartControl";

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

const frequencyControl = frequencyChartControl.setup();
const waveformControl = waveformChartControl.setup();

const charts: IAnimatedChart[] = [waveformControl.chart, frequencyControl.chart];

playbackControl.setup(charts);

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

filterControl.setup(
	/*onActivate*/() => {
		// add original data charts
		waveformControl.chart.link(waveformControl.chartWithNoFilters);
		frequencyControl.chart.link(frequencyControl.chartWithNoFilters);

		// re-setup regular chart options
		waveformControl.chart.setOptions({ clearCanvas: false });
		frequencyControl.chart.setOptions({ drawLabels: false, clearCanvas: false });
	},
	/*onDeactivate*/() => {
		// remove original data charts
		waveformControl.chart.unlink(waveformControl.chartWithNoFilters);
		frequencyControl.chart.unlink(frequencyControl.chartWithNoFilters);

		// re-setup regular chart options
		waveformControl.chart.setOptions({ clearCanvas: true });
		frequencyControl.chart.setOptions({ drawLabels: true, clearCanvas: true });
	}
);
