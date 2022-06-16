import { h } from 'preact';

type IProps = {
  d: string,
  [key: string]: any;
};

function Path(props: IProps) {
  const attrs = {
    d: '',
  };
  Object.entries(props).forEach(([k, v]) => {
    const valueType = typeof v;
    if (k === 'style' || valueType !== 'object') {
      attrs[k] = v;
    }
  });
  return (
    <path {...attrs} />
  );
}

export default Path;
