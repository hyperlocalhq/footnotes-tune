import { make } from './dom';
import styles from './note.pcss';
import Popover from './popover';
import { nanoid } from 'nanoid';

/**
 * Interface describes data footnote outputs
 */
export interface NoteData {
  /**
   * Note's id
   */
  id: string;

  /**
   * Note's content
   */
  content: string;

  /**
   * Note's superscript index
   */
  superscript: number;
}

/**
 * Note object
 */
export default class Note {
  /**
   * data-tune value
   */
  public static dataAttribute = 'footnotes';

  /**
   * Note's id
   */
  public id: string;

  /**
   * Note's content
   */
  public content = '';

  /**
   * Range which contain sup element
   */
  public range: Range;

  /**
   * Sup element
   */
  public node: HTMLElement = make('sup', styles['ej-fn-sup'], { contentEditable: 'false' });

  /**
   * Note's index
   */
  private _index = 0;

  /**
   * Editable popover
   */
  private popover: Popover;

  /**
   * @param rangeOrNode - range to insert sup or existing sup to hydrate
   * @param popover - editable popover
   * @param id - Note's id if presented
   */
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  constructor(rangeOrNode: Range | HTMLElement, popover: Popover, id = nanoid(6)) {
    this.popover = popover;
    this.id = id;

    if (rangeOrNode instanceof Range) {
      this.range = rangeOrNode;
      rangeOrNode.insertNode(this.node);
    } else {
      this.node = rangeOrNode;
      this.node.contentEditable = 'false';
      this.node.classList.add(styles['ej-fn-sup']);

      this.range = new Range();

      this.range.selectNode(this.node);
    }

    this.node.dataset.tune = Note.dataAttribute;
    this.node.dataset.id = this.id;
    this.node.textContent = '*';
    this.node.removeEventListener('click', this.openPopover);
    this.node.addEventListener('click', this.openPopover);
  }

  /**
   * Returns note's index
   */
  public get index(): number {
    return this._index;
  }

  /**
   * Updates note's index
   */
  public set index(index: number) {
    this._index = index;
    this.updateNodeContent();
  }

  /**
   * Removes sup element from DOM
   */
  public remove(): void {
    this.node.remove();
  }

  /**
   * Save's notes content
   */
  public save(): NoteData {
    return {
      id: this.id,
      content: this.content,
      superscript: this._index,
    };
  }

  public listenToClicks(): void {
    this.node.removeEventListener('click', this.openPopover);
    this.node.addEventListener('click', this.openPopover);
  }

  public updatePopover(popover: Popover): void {
    this.popover = popover;
  }

  private openPopover = (): void => {
    this.popover.open(this);
  };

  private updateNodeContent(): void {
    this.node.textContent = this._index.toString();
  }
}
