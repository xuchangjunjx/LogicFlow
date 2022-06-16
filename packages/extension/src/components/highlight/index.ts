import LogicFlow, { BaseNodeModel } from '@logicflow/core';

// 后续并入FlowPath
const getPath = (id: string, lf: LogicFlow) => {
  const el = lf.getModelById(id);
  return getNodePath(el.BaseType === 'node' ? el : el.targetNode, lf);
};

// dfs + 动态规划
// todo 算法优化
const getNodePath = (node, lf: LogicFlow) => {
  const incomingPaths = [];
  const outgoingPaths = [];

  const getIncomingPaths = (curNode, path, prevNode = null) => {
    if (prevNode) {
      // * 上个节点和当前节点中间边
      path.unshift(
        ...lf
          .getEdgeModels({
            sourceNodeId: curNode.id,
            targetNodeId: prevNode.id,
          })
          .map((item) => item.id),
      );
    }

    // * 路径中存在节点，则不再继续查找，说明出现环情况
    if (path.includes(curNode.id)) {
      incomingPaths.push(path);
      return;
    }

    // * 路径中当前加入节点
    path.unshift(curNode.id);

    if (!curNode.incoming.nodes.length) {
      incomingPaths.push(path);
      return;
    }

    // * 往下找
    curNode.incoming.nodes.forEach((nextNode) => {
      getIncomingPaths(nextNode, path.slice(), curNode);
    });
  };

  // * 同上逻辑
  const getOutgoingPaths = (curNode, path, prevNode = null) => {
    if (prevNode) {
      path.push(
        ...lf
          .getEdgeModels({
            sourceNodeId: prevNode.id,
            targetNodeId: curNode.id,
          })
          .map((item) => item.id),
      );
    }
    if (path.includes(curNode.id)) {
      outgoingPaths.push(path);
      return;
    }

    path.push(curNode.id);

    if (!curNode.outgoing.nodes.length) {
      outgoingPaths.push(path);
      return;
    }

    curNode.outgoing.nodes.forEach((nextNode) => {
      getOutgoingPaths(nextNode, path.slice(), curNode);
    });
  };

  getIncomingPaths(node, []);
  getOutgoingPaths(node, []);

  return [...new Set([...incomingPaths.flat(), ...outgoingPaths.flat()])];
};

type IMode = 'single' | 'path';

class Highlight {
  lf: LogicFlow;
  static pluginName = 'highlight';
  mode: IMode = 'path';
  manual = false;
  tempStyles = {};
  constructor({ lf }) {
    this.lf = lf;
  }

  setMode(mode: IMode) {
    this.mode = mode;
  }

  setManual(manual: boolean) {
    this.manual = manual;
  }

  private highlightSingle(id: string) {
    const model = this.lf.getModelById(id);

    if (model.BaseType === 'node') {
      // 高亮节点
      model.updateStyles(this.tempStyles[id]);
    } else if (model.BaseType === 'edge') {
      // 高亮边及对应的节点
      model.updateStyles(this.tempStyles[id]);
      model.sourceNode.updateStyles(this.tempStyles[model.sourceNode.id]);
      model.targetNode.updateStyles(this.tempStyles[model.targetNode.id]);
    }
  }

  private highlightPath(id: string) {
    const path = getPath(id, this.lf);
    path.forEach((_id) => {
      // 高亮路径上所有的边和节点
      this.lf.getModelById(_id).updateStyles(this.tempStyles[_id]);
    });
  }

  highlight(id: string, mode: IMode = this.mode) {
    if (this.manual) return;
    if (Object.keys(this.tempStyles).length) {
      this.restoreHighlight();
    }

    Object.values(this.lf.graphModel.modelsMap).forEach((item) => {
      //  所有节点样式都进行备份
      // eslint-disable-next-line operator-linebreak
      const oStyle =
        item.BaseType === 'node' ? item.getNodeStyle() : item.getEdgeStyle();
      this.tempStyles[item.id] = { ...oStyle };

      //  所有节点都设置透明度为0.1
      item.setStyles({ opacity: 0.1 });
    });

    const modeTrigger = {
      single: this.highlightSingle.bind(this),
      path: this.highlightPath.bind(this),
    };

    modeTrigger[mode](id);
  }

  restoreHighlight() {
    // 恢复所有节点的样式
    if (!Object.keys(this.tempStyles).length) return;
    Object.values(this.lf.graphModel.modelsMap).forEach((item) => {
      const oStyle = this.tempStyles[item.id] ?? {};
      item.updateStyles({ ...oStyle });
    });

    this.tempStyles = {};
  }

  render(lf, domContainer) {
    this.lf.on('node:mouseenter', ({ data }) => this.highlight(data.id));
    this.lf.on('edge:mouseenter', ({ data }) => this.highlight(data.id));

    this.lf.on('node:mouseleave', this.restoreHighlight.bind(this));
    this.lf.on('edge:mouseleave', this.restoreHighlight.bind(this));
    this.lf.on('history:change', this.restoreHighlight.bind(this));
  }

  destroy() {}
}

export { Highlight };
