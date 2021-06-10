///<amd-module name='waveformChartControl'/>

import { WaveformChart } from "./charts";
import * as audioGraph from "./audioGraph";

export interface IWaveformChartControl {
    chart: WaveformChart;
    chartWithNoFilters: WaveformChart;
}

const maxDrawSamplesElem = document.getElementById('maxDrawSamples') as HTMLInputElement;
const maxDrawLinesElem = document.getElementById('maxDrawLines') as HTMLInputElement;

function setupChartOptions(waveformChart: WaveformChart) {
    maxDrawSamplesElem.addEventListener('input', function() {
        waveformChart.reset();
    });

    maxDrawLinesElem.addEventListener('input', function() {
        waveformChart.reset();
    });
}

export function setup(): IWaveformChartControl {
    const waveformCanvasElem = document.getElementById('waveformCanvas') as HTMLCanvasElement;

    const waveformChart = new WaveformChart(waveformCanvasElem, audioGraph.analyserNode, maxDrawLinesElem, maxDrawSamplesElem);
    setupChartOptions(waveformChart);

    const originalWaveformChart = new WaveformChart(waveformCanvasElem, audioGraph.originalAnalyserNode, maxDrawLinesElem, maxDrawSamplesElem);
    originalWaveformChart.setOptions({
        customLineStrokeStyle: 'darkgreen'
    });

    return {
        chart: waveformChart,
        chartWithNoFilters: originalWaveformChart
    };
}
