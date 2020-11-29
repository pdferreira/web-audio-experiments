///<amd-module name='charts'/>

// SPN = Scientific Pitch Notation
const spnToSolfegeNotation: { [noteName: string]: string } = {
	'C': 'Do',
	'D': 'Re',
	'E': 'Mi',
	'F': 'Fa',
	'G': 'Sol',
	'A': 'La',
	'B': 'Si'
};

function translateToSolfegeNotation(spnNoteName: string) {
	return spnToSolfegeNotation[spnNoteName[0]] + spnNoteName.substring(1);
}

function numberToSubscript(number: number) {
	const numberText = number.toString();
	var result = "";
	for (var i = 0; i < numberText.length; i++) {
		const digitCharCode = numberText.charCodeAt(i);
		result += String.fromCharCode(digitCharCode + 8272);
	}
	return result;
}

function checkIfTextFits(ctx: CanvasRenderingContext2D, text: string, maxAllowedWidth: number) {
	const textWidth = ctx.measureText(text).width;
	return textWidth <= maxAllowedWidth;
}

function fillTextIfFits(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxAllowedWidth: number) {
	if (checkIfTextFits(ctx, text, maxAllowedWidth)) {
		ctx.fillText(text, x, y);
	}
}

function isDefined<T>(value: T): value is NonNullable<T> {
    return value !== undefined && value !== null;
}

export interface IAnimatedChart {
    readonly isActive: boolean;
    start(): void;
    stop(): void;
    reset(): void;
}

interface ILinkableChart<ChartT extends IAnimatedChart> {
    link(chart: ChartT): void;
    unlink(chart: ChartT): void;
}

export interface IConfigurableChart<OptionsT extends object> {
    setOptions(options: Partial<OptionsT>): void;
    updateOptions(options: (current: OptionsT) => Partial<OptionsT>): void;
}

abstract class AbstractAnimatedChart<
    SelfT extends AbstractAnimatedChart<SelfT, OptionsT>,
    OptionsT extends object
>
    implements IAnimatedChart, ILinkableChart<SelfT>, IConfigurableChart<OptionsT>
{

	private animationHandle: number | null;
    private linkedCharts: SelfT[];
    
    protected readonly options: OptionsT;
    protected readonly linkedOptions: (keyof OptionsT)[];
    protected data: Uint8Array;
	
	public isActive: boolean;

    constructor(options: OptionsT, linkableOptions: (keyof OptionsT)[]) {
        this.animationHandle = null;
        this.linkedCharts = [];
        this.options = options;
        this.linkedOptions = linkableOptions;
        this.data =  new Uint8Array(0);
        this.isActive = false;
	}

    protected abstract innerReset(): void;    
	protected abstract draw(): void;
    
	private animate(): void {
        if (this.isActive) {
            this.animationHandle = window.requestAnimationFrame(this.animate.bind(this));
		}
        
		this.draw();
    }

    private resetAnimation(): void {
        if (this.animationHandle) {
            window.cancelAnimationFrame(this.animationHandle);
			this.animationHandle = null;
        }

        this.animationHandle = window.requestAnimationFrame(this.animate.bind(this))
    }
    
    private getOnlyLinkedOptions(options: Partial<OptionsT>): Partial<OptionsT> {
        let filteredOptions: Partial<OptionsT> = {};
        for (let prop in options) {
            if (this.linkedOptions.indexOf(prop) >= 0) {
                filteredOptions[prop] = options[prop];
            }
        }
        return filteredOptions;
    } 
    
    public reset(): void {
        this.innerReset();
        this.linkedCharts.forEach(c => c.reset());
    }

    public start() {
        if (this.isActive) {
            return;
        }

		this.innerReset();
		this.isActive = true;
        this.linkedCharts.forEach(c => c.start());

        // main chart gets rendered last
        this.animate();
	}

    public stop() {
        if (!this.isActive) {
            return;
        }

		this.isActive = false;
		if (this.animationHandle) {
			window.cancelAnimationFrame(this.animationHandle);
			this.animationHandle = null;
        }
        this.linkedCharts.forEach(c => c.stop());
    }
    
    public link(chart: SelfT) {
        this.linkedCharts.push(chart);
        
        chart.setOptions(this.getOnlyLinkedOptions(this.options));

        if (this.isActive) {
            chart.start();
            this.resetAnimation();
        } else {
            chart.stop();
        }
    }

    public unlink(chart: SelfT) {
        const idx = this.linkedCharts.indexOf(chart);
        if (idx >= 0) {
            this.linkedCharts = this.linkedCharts.splice(idx, 1);
        }

        chart.stop();
    }

    public updateOptions(getOptions: (current: OptionsT) => Partial<OptionsT>): void {
        this.setOptions(getOptions(this.options));
    }
    
    public setOptions(options: Partial<OptionsT>): void {
        for (let prop in options) {
            var optValue = options[prop];
            if (isDefined(optValue)) {
                this.options[prop] = optValue;
            }
        }
        this.innerReset();

        const linkedOptions = this.getOnlyLinkedOptions(options);
        this.linkedCharts.forEach(c => c.setOptions(linkedOptions));
    }

}

interface IWaveformChartOptions {
	clearCanvas: boolean;
	customLineStrokeStyle?: string;
}

export class WaveformChart extends AbstractAnimatedChart<WaveformChart, IWaveformChartOptions> {

	private readonly analyserNode: AnalyserNode;
	private readonly width: number;
	private readonly height: number;
    private readonly canvasCtx: CanvasRenderingContext2D;
    private readonly maxDrawLinesElem: HTMLInputElement;
    private readonly maxDrawSamplesElem: HTMLInputElement;
	
	private maxDrawSpanY: number = 0;
	private maxDrawSpanX: number = 0;
	private drawSpanX: number = 0;
	private drawSpanY: number = 0;
	private y: number = 0;

	constructor (
        canvasElem: HTMLCanvasElement,
        analyserNode: AnalyserNode,
        maxDrawLinesElem: HTMLInputElement,
        maxDrawSamplesElem: HTMLInputElement
    ) {
        super({ clearCanvas: true }, []);
		this.analyserNode = analyserNode;
		this.width = canvasElem.width;
		this.height = canvasElem.height;
        this.canvasCtx = canvasElem.getContext('2d')!;
        this.maxDrawLinesElem = maxDrawLinesElem;
        this.maxDrawSamplesElem = maxDrawSamplesElem;
	}

	protected innerReset() {
		this.data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.maxDrawSpanY = parseInt(this.maxDrawLinesElem.value);
		this.maxDrawSpanX = parseInt(this.maxDrawSamplesElem.value) / this.maxDrawSpanY,
		this.drawSpanX = 0;
		this.drawSpanY = 0;
		this.y = 0;
	}

    private getDefaultLineStrokeStyle() {
        return 'rgb(' + (255 * this.drawSpanX / this.maxDrawSpanX) + ', 0, ' + (255 * this.drawSpanY / this.maxDrawSpanY) + ')';
	}

	protected draw() {
		this.analyserNode.getByteTimeDomainData(this.data);

		if (this.options.clearCanvas && this.drawSpanX == 0 && this.drawSpanY == 0) {
			this.canvasCtx.fillStyle = 'rgb(200, 200, 200)';
			this.canvasCtx.fillRect(0, 0, this.width, this.height);
		}
		
		this.canvasCtx.lineWidth = 1;
		this.canvasCtx.strokeStyle = this.options.customLineStrokeStyle ?? this.getDefaultLineStrokeStyle();
		this.canvasCtx.beginPath();
		
		const sliceWidth = (this.width / this.maxDrawSpanX) * 1.0 / this.data.length;
		var x = this.drawSpanX * this.width / this.maxDrawSpanX;
		
		if (this.drawSpanX > 0) {
			this.canvasCtx.moveTo(x - sliceWidth, this.y);
		}
		
		for(var i = 0; i < this.data.length; i++) {
	
			const v = this.data[i] / 128.0;
			this.y = (this.drawSpanY * this.height/ this.maxDrawSpanY) + v * (this.height / this.maxDrawSpanY) / 2;

			if (i === 0 && this.drawSpanX == 0) {
				this.canvasCtx.moveTo(x, this.y);
			} else {
				this.canvasCtx.lineTo(x, this.y);
			}

			x += sliceWidth;
		}
		
		this.canvasCtx.stroke();

		this.drawSpanX++;
		if (this.drawSpanX >= this.maxDrawSpanX) {
			this.drawSpanX = 0;
			this.drawSpanY++;
			if (this.drawSpanY >= this.maxDrawSpanY) {
				this.drawSpanY = 0;
			}
		}
	}

}


type MouseEventHandler = (evt: MouseEvent) => any;

interface IFrequencyBarChartOptions {
	drawLabels: boolean;
	drawChromaticScale: boolean;
	useSolfegeNotation: boolean;
	clearCanvas: boolean;
	logScale: boolean;
	scaleX: number;
	customBarFillStyle?: string;
}

export class FrequencyBarChart extends AbstractAnimatedChart<FrequencyBarChart, IFrequencyBarChartOptions> {
	
	private static readonly chromaticScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	private static readonly chromaticScaleInSolfege = FrequencyBarChart.chromaticScale.map(translateToSolfegeNotation);
    
    private readonly analyserNode: AnalyserNode;
	private readonly canvasCtx: CanvasRenderingContext2D;
    private readonly canvasElem: HTMLCanvasElement;
    
	private mouseMoveHandler: MouseEventHandler;
	private mouseUpHandler: MouseEventHandler;
	private mouseDownHandler: MouseEventHandler;
	private startX: number = 0;
	private width: number = 0;
	private height: number = 0;
	private barUnitWidth: number = 0;
	private barUnitSpacingWidth: number = 0;
	
	constructor (canvasElem: HTMLCanvasElement, analyserNode: AnalyserNode) {
        super({
            drawLabels: true,
            drawChromaticScale: false,
            useSolfegeNotation: false,
            clearCanvas: true,
            logScale: false,
            scaleX: 1
        }, [
            "scaleX",
            "logScale"
        ]);
        this.analyserNode = analyserNode;
        this.canvasElem = canvasElem;
        this.canvasCtx = canvasElem.getContext('2d')!;
        
        // initialize mouse event handlers
        var isDragging = false;

		this.mouseDownHandler = () => {
			isDragging = true;
		};
		this.mouseMoveHandler = (evt: MouseEvent) => {
			if (isDragging) {
				this.startX = Math.min(0, this.startX + evt.movementX);
			}
		};
		this.mouseUpHandler = () => {
			isDragging = false;
		};
	}

    private registerMouseEvents() {
		this.canvasElem.addEventListener('mousedown', this.mouseDownHandler);
		this.canvasElem.addEventListener('mousemove', this.mouseMoveHandler);
		this.canvasElem.addEventListener('mouseup', this.mouseUpHandler);
    }

	private unregisterMouseEvents() {
		this.canvasElem.removeEventListener('mousemove', this.mouseMoveHandler);
		this.canvasElem.removeEventListener('mouseup', this.mouseUpHandler);
		this.canvasElem.removeEventListener('mousedown', this.mouseDownHandler);
	}
		
	public start() {
        super.start();
        this.registerMouseEvents();
	}

	public stop() {
		super.stop();
		this.unregisterMouseEvents();
	}

	protected innerReset() {
		this.data = new Uint8Array(this.analyserNode.frequencyBinCount);
		this.width = this.canvasElem.width / this.options.scaleX;
		this.height = this.canvasElem.height;

		this.startX = 0;

		const spacingTotalWidth = this.width / 10;
		this.barUnitWidth = (this.width - spacingTotalWidth) / this.data.length;
		this.barUnitSpacingWidth = spacingTotalWidth / (this.data.length - 1);
	}

    private getDefaultBarFillStyle(barIdx: number) {
		return 'rgb(' + (this.data[barIdx] / 2 + 150) + ', 0, 0)';
	}

	private drawNoteScale(noteScale: string[]) {
			const noteWidth = this.barUnitWidth + this.barUnitSpacingWidth;
			const noteSectionWidth = noteScale.length * noteWidth;
			const labelMargin = 5;
			const maxNoteTextWidth = noteWidth - 2;

			var octavePos = 0;
			var frequency = 16.35; // start in C_0 note frequency, which is 16.35 Hz
			var x = this.startX + Math.log2(frequency) * noteSectionWidth - noteWidth / 2;
			var evenIteration = true;

			while (x < this.canvasElem.width) {
				// fill section background in a even/odd pattern
				this.canvasCtx.fillStyle = evenIteration ? '#222222' : 'black';
				this.canvasCtx.fillRect(x, 0, noteSectionWidth, this.canvasElem.height);
				
				// divide the section in sub-sections for each note (if readable at all)
				const octaveText = numberToSubscript(octavePos);
				const sampleNote = noteScale[0] + octaveText;
				if (checkIfTextFits(this.canvasCtx, sampleNote, maxNoteTextWidth)) {
					noteScale.forEach((note, idx) => {
						const noteX = x + idx * noteWidth;
						const noteMaxX = noteX + noteWidth - 1;
						const startY = 30;

						this.canvasCtx.strokeStyle = 'gray';
						this.canvasCtx.beginPath();
						this.canvasCtx.moveTo(noteMaxX, startY);
						this.canvasCtx.lineTo(noteMaxX, this.canvasElem.height);
						this.canvasCtx.stroke();
						
						this.canvasCtx.fillStyle = 'gray';
						this.canvasCtx.textAlign = 'center';
						fillTextIfFits(this.canvasCtx, note + octaveText, noteX + noteWidth / 2 - 1, startY, maxNoteTextWidth);
					});
				}

				// draw frequency label on top of the section
				if (this.options.drawLabels) {
					this.canvasCtx.fillStyle = 'white';
					this.canvasCtx.textAlign = 'left';
					this.canvasCtx.textBaseline = 'top';
					fillTextIfFits(this.canvasCtx, frequency + ' Hz', x + labelMargin, labelMargin, noteSectionWidth - labelMargin * 2);
				}

				x += noteSectionWidth;
				frequency *= 2;
				octavePos++;
				evenIteration = !evenIteration;
			}
	}

	private drawFrequencyBars(chromaticScale: string[]) {
		const maxFrequency = this.analyserNode.context.sampleRate / 2;
		var x = this.startX as number;
		var prevFrequency = 1;
		var accData = new Array();
		var lastLabelEndX: number | null = null;

		for (var i = 0; i < this.data.length; i++) {
			accData.push(this.data[i]);

			const frequency = maxFrequency * (i + 1) / this.data.length;
			var barWidth: number, barSpacingWidth: number;

			if (this.options.logScale) {
				const exponentScalingFactor = chromaticScale.length * (Math.log2(frequency) - Math.log2(prevFrequency));
				barWidth = this.barUnitWidth * exponentScalingFactor;
				barSpacingWidth = this.barUnitSpacingWidth * exponentScalingFactor;
			} else {
				barWidth = this.barUnitWidth * accData.length;
				barSpacingWidth = this.barUnitSpacingWidth;
			}

			if (x >= this.canvasElem.width) {
				// no longer visible inside canvas, no use in drawing
				break;
			}

			// draw the bar if the accumulated width is meaningful
			// otherwise just accumulate and perform the average later
			// (better performance and also less cluttered visual)		
			if (barWidth < 0.5) {
				continue;
			}
			
			const avgAccData = accData.reduce((sum, v) => sum + v) / accData.length;
			const barHeight = avgAccData / 2;
			const y = this.height - barHeight;

			this.canvasCtx.fillStyle = this.options.customBarFillStyle ?? this.getDefaultBarFillStyle(i);
			this.canvasCtx.fillRect(x, y, barWidth, barHeight);
			
			if (this.options.drawLabels) {
				const label = Math.round(frequency) + 'Hz';
				const labelWidth = this.canvasCtx.measureText(label).width;
				const labelCenterX = x + barWidth / 2;
				const labelStartX = labelCenterX - labelWidth / 2;

				if (lastLabelEndX === null || labelStartX - lastLabelEndX >= 20) {
					lastLabelEndX = labelStartX + labelWidth;

					this.canvasCtx.fillStyle = 'white';
					this.canvasCtx.textAlign = 'center';
					this.canvasCtx.fillText(label, labelCenterX, y - 20);

				}
			}
			
			x += barWidth + barSpacingWidth;
			prevFrequency = frequency;
			accData = new Array();
		}
	}

	protected draw() {
		this.analyserNode.getByteFrequencyData(this.data);

		if (this.options.clearCanvas) {
			this.canvasCtx.fillStyle = 'black';
			this.canvasCtx.fillRect(0, 0, this.canvasElem.width, this.canvasElem.height);
		}

		var chromaticScale = this.options.useSolfegeNotation ? 
			FrequencyBarChart.chromaticScaleInSolfege :
			FrequencyBarChart.chromaticScale;

		if (this.options.drawChromaticScale && this.options.logScale) {
			this.drawNoteScale(chromaticScale);
		}
		
		this.drawFrequencyBars(chromaticScale);
	}

}
