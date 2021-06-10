///<amd-module name='frequencyChartControl'/>

import { FrequencyBarChart } from "./charts";
import * as audioGraph from "./audioGraph";

export interface IFrequencyChartControl {
	chart: FrequencyBarChart;
	chartWithNoFilters: FrequencyBarChart;
}

function setupScaleControl(freqChart: FrequencyBarChart) {
	const freqChartScaleElems = document.getElementsByName('freqChartScale') as NodeListOf<HTMLInputElement>;
	for (const elem of freqChartScaleElems) {
		elem.addEventListener('input', function () {
			if (this.checked) {
				const useLogScale = this.value === 'log';

				freqChart.setOptions({
					logScale: useLogScale,
					drawChromaticScale: useLogScale,
					scaleX: useLogScale ? Math.pow(2, -7) : 1 // useful default
				});
			}
		});
		elem.dispatchEvent(new Event('input'));
	}
}

function setupZoomControl(freqChart: FrequencyBarChart) {
	const zoomInElem = document.getElementById('zoomInBtn')!;
	const zoomOutElem = document.getElementById('zoomOutBtn')!;
	const zoomResetElem = document.getElementById('zoomResetBtn')!;
	
	zoomInElem.addEventListener('click', function () {
		freqChart.updateOptions(opt => ({ scaleX: opt.scaleX / 2 }));
	});

	zoomOutElem.addEventListener('click', function () {
		freqChart.updateOptions(opt => ({ scaleX: opt.scaleX * 2}));
	});

	zoomResetElem.addEventListener('click', function () {
		freqChart.setOptions({ scaleX: 1 });
	});
}

export function setup(): IFrequencyChartControl {
	const frequencyCanvasElem = document.getElementById('frequencyBarCanvas') as HTMLCanvasElement;

	const frequencyBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.analyserNode);
	setupScaleControl(frequencyBarChart);
	setupZoomControl(frequencyBarChart);

	const originalFreqBarChart = new FrequencyBarChart(frequencyCanvasElem, audioGraph.originalAnalyserNode);
	originalFreqBarChart.setOptions({
		customBarFillStyle: 'gray'
	});

	return {
		chart: frequencyBarChart,
		chartWithNoFilters: originalFreqBarChart
	};
}