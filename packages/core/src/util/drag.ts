import { noop } from 'lodash-es';
import { EventType } from '../constant/constant';
import EventEmitter from '../event/eventEmitter';
import BaseEdgeModel from '../model/edge/BaseEdgeModel';
import BaseNodeModel from '../model/node/BaseNodeModel';
// import { snapToGrid } from './geometry';

const DOC = window.document;
const LEFT_MOUSE_BUTTON_CODE = 0;

function createDrag({
  onDragStart = noop,
  onDraging = noop,
  onDragEnd = noop,
  step = 1,
  isStopPropagation = true,
}) {
  let isDraging = false;
  let isStartDraging = false;
  let startX = 0;
  let startY = 0;
  let sumDeltaX = 0;
  let sumDeltaY = 0;
  function handleMouseMove(e: MouseEvent) {
    if (isStopPropagation) e.stopPropagation();
    if (!isStartDraging) return;
    isDraging = true;
    sumDeltaX += e.clientX - startX;
    sumDeltaY += e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    if (Math.abs(sumDeltaX) > step || Math.abs(sumDeltaY) > step) {
      const remainderX = sumDeltaX % step;
      const remainderY = sumDeltaY % step;
      const deltaX = sumDeltaX - remainderX;
      const deltaY = sumDeltaY - remainderY;
      sumDeltaX = remainderX;
      sumDeltaY = remainderY;
      onDraging({ deltaX, deltaY, event: e });
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (isStopPropagation) e.stopPropagation();
    isStartDraging = false;
    DOC.removeEventListener('mousemove', handleMouseMove, false);
    DOC.removeEventListener('mouseup', handleMouseUp, false);
    if (!isDraging) return;
    isDraging = false;
    return onDragEnd({ event: e });
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== LEFT_MOUSE_BUTTON_CODE) return;
    if (isStopPropagation) e.stopPropagation();

    isStartDraging = true;
    startX = e.clientX;
    startY = e.clientY;

    DOC.addEventListener('mousemove', handleMouseMove, false);
    DOC.addEventListener('mouseup', handleMouseUp, false);
    return onDragStart({ event: e });
  }

  return handleMouseDown;
}

// 支持拖拽的时候，按照指定step进行。
// 因为在绘制的过程中因为放大缩小，移动的真实的step则是变化的。
class StepDrag {
  onDragStart: Function;
  onDraging: Function;
  onDragEnd: Function;
  step: number;
  isStopPropagation: boolean;
  isDraging = false;
  isStartDraging = false;
  startX = 0;
  startY = 0;
  sumDeltaX = 0;
  sumDeltaY = 0;
  eventType: string;
  eventCenter: EventEmitter | null;
  model?: BaseNodeModel | BaseEdgeModel;
  startTime?: number;
  isGrag: boolean;
  constructor({
    onDragStart = noop,
    onDraging = noop,
    onDragEnd = noop,
    eventType = '',
    eventCenter = null,
    step = 1,
    isStopPropagation = true,
    model = null,
  }) {
    this.onDragStart = onDragStart;
    this.onDraging = onDraging;
    this.onDragEnd = onDragEnd;
    this.step = step;
    this.isStopPropagation = isStopPropagation;
    this.eventType = eventType;
    this.eventCenter = eventCenter;
    this.model = model;
  }
  setStep(step: number) {
    this.step = step;
  }
  handleMouseDown = (e: MouseEvent) => {
    if (e.button !== LEFT_MOUSE_BUTTON_CODE) return;
    if (this.isStopPropagation) e.stopPropagation();
    this.isStartDraging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;

    DOC.addEventListener('mousemove', this.handleMouseMove, false);
    DOC.addEventListener('mouseup', this.handleMouseUp, false);
    const elementData = this.model?.getData();
    this.eventCenter?.emit(EventType[`${this.eventType}_MOUSEDOWN`], { e, data: elementData });
    this.startTime = new Date().getTime();
  };
  handleMouseMove = (e: MouseEvent) => {
    if (this.isStopPropagation) e.stopPropagation();
    if (!this.isStartDraging) return;
    this.sumDeltaX += e.clientX - this.startX;
    this.sumDeltaY += e.clientY - this.startY;
    this.startX = e.clientX;
    this.startY = e.clientY;
    if (
      this.step <= 1
      || Math.abs(this.sumDeltaX) > this.step
      || Math.abs(this.sumDeltaY) > this.step
    ) {
      const remainderX = this.sumDeltaX % this.step;
      const remainderY = this.sumDeltaY % this.step;
      const deltaX = this.sumDeltaX - remainderX;
      const deltaY = this.sumDeltaY - remainderY;
      this.sumDeltaX = remainderX;
      this.sumDeltaY = remainderY;
      const elementData = this.model?.getData();
      /**
       * 为了区分点击和拖动，在鼠标没有拖动时，不触发dragstart。
       */
      if (!this.isDraging) {
        this.eventCenter?.emit(EventType[`${this.eventType}_DRAGSTART`], { e, data: elementData });
        this.onDragStart({ event: e });
      }
      this.isDraging = true;
      // 为了让dragstart和drag不在同一个事件循环中，使drag事件放到下一个消息队列中。
      Promise.resolve().then(() => {
        this.onDraging({ deltaX, deltaY, event: e });
        this.eventCenter?.emit(EventType[`${this.eventType}_MOUSEMOVE`], { e, data: elementData });
        this.eventCenter?.emit(EventType[`${this.eventType}_DRAG`], { e, data: elementData });
      });
    }
  };
  handleMouseUp = (e: MouseEvent) => {
    this.isStartDraging = false;
    if (this.isStopPropagation) e.stopPropagation();
    // fix #568: 如果onDraging在下一个事件循环中触发，而drop在当前事件循环，会出现问题。
    Promise.resolve().then(() => {
      DOC.removeEventListener('mousemove', this.handleMouseMove, false);
      DOC.removeEventListener('mouseup', this.handleMouseUp, false);
      const elementData = this.model?.getData();
      this.eventCenter?.emit(EventType[`${this.eventType}_MOUSEUP`], { e, data: elementData });
      if (!this.isDraging) return;
      this.isDraging = false;
      this.onDragEnd({ event: e });
      this.eventCenter?.emit(EventType[`${this.eventType}_DROP`], { e, data: elementData });
    });
  };
  cancelDrag = () => {
    DOC.removeEventListener('mousemove', this.handleMouseMove, false);
    DOC.removeEventListener('mouseup', this.handleMouseUp, false);
    this.isDraging = false;
  };
}

export {
  createDrag,
  StepDrag,
};
