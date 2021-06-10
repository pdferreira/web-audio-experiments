///<amd-module name='chartControl'/>

import { IAnimatedChart } from "./charts";
import * as frequencyChartControl from "./frequencyChartControl";
import * as waveformChartControl from "./waveformChartControl";
import * as audioGraph from "./audioGraph";

interface IChartControl {
	frequencyControl: frequencyChartControl.IFrequencyChartControl;
	waveformControl: waveformChartControl.IWaveformChartControl;
}

function setupFFTControl(charts: IAnimatedChart[]) {
	const fftSizeElem = document.getElementById('fftSize') as HTMLInputElement;
	audioGraph.analyserNode.fftSize = parseInt(fftSizeElem.value);
	audioGraph.originalAnalyserNode.fftSize = audioGraph.analyserNode.fftSize;	

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
}

export function setup(): IChartControl {
	const frequencyControl = frequencyChartControl.setup();
	const waveformControl = waveformChartControl.setup();
	setupFFTControl([frequencyControl.chart, waveformControl.chart]);

	return {
		frequencyControl,
		waveformControl
	}
}
