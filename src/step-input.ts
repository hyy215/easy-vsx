import { Disposable, InputBox, QuickInputButtons, QuickPick, QuickPickItem, window } from 'vscode';

export interface InputBoxStep {
    title: string;
    value?: string;
    placeholder?: string;
    prompt?: string;
    password?: boolean;
    validate?: (value: string) => boolean;
    validationMessage?: string;
}

export type QuickPickStepItemFn = () => PromiseLike<QuickPickItem[]>;
export interface QuickPickStep {
    title: string;
    items: QuickPickStepItemFn | QuickPickItem[];
    selectedItems?: Readonly<QuickPickItem[]>;
    placeholder?: string;
    canSelectMany?: boolean;
}

export type Step = InputBoxStep | QuickPickStep;

export function isQuickPickStep(step: Step): step is QuickPickStep {
    return (step as any)?.items;
}

export type StepResult = Readonly<QuickPickItem[]> | string | undefined;

export enum StepStatus {
    back,
    canecl,
}

export const START_STEP = 1;

export class StepInput {
    protected _steps: Step[];
    protected _totalSteps: number;
    protected _current: QuickPick<QuickPickItem> | InputBox | undefined;

    static async run(steps: Step[]): Promise<StepResult[] | undefined> {
        if (!steps.length) {
            console.error('Invalid Steps.');
            return;
        }

        const stepInput = new StepInput(steps);
        return stepInput.stepThrough(START_STEP);
    }

    constructor(steps: Step[]) {
        this._steps = steps;
        this._totalSteps = steps.length;
    }

    async stepThrough(step: number) {
        let steping = true;

        while (steping) {
            try {
                if (step < START_STEP || step > this._totalSteps) {
                    throw new Error('Invalid Step.');
                }

                await this.step(step);
                step += 1;

                if (step > this._totalSteps) {
                    return this._steps.map(step => {
                        if (isQuickPickStep(step)) {
                            return step.selectedItems;
                        } else {
                            return step.value;
                        }
                    });
                }
            } catch (e) {
                if (e === StepStatus.back) {
                    step -= 1;
                } else if (e === StepStatus.canecl) {
                    console.log('Cancel Step.');
                    return;
                } else {
                    throw e;
                }
            } finally {
                this._current?.dispose();
            }
        }
    }

    step(step: number) {
        const state = this.getStateOfStep(step);
        if (isQuickPickStep(state)) {
            return this.showQuickPick(step, state);
        } else {
            return this.showInputBox(step, state);
        }
    }

    getStateOfStep(step: number) {
        return this._steps[step - 1];
    }

    async createQuickPick(step: number, state: QuickPickStep) {
        const pick = window.createQuickPick();

        pick.title = state.title;
        pick.placeholder = state.placeholder;
        pick.canSelectMany = !!state.canSelectMany;
        pick.step = step;
        pick.totalSteps = this._totalSteps;
        pick.ignoreFocusOut = true;
        pick.buttons = [...(step !== START_STEP ? [QuickInputButtons.Back] : [])];
        pick.enabled = false;
        pick.selectedItems = state.selectedItems || [];

        return pick;
    }

    async showQuickPick(step: number, state: QuickPickStep): Promise<void> {
        const disposables: Disposable[] = [];

        try {
            const pick = await this.createQuickPick(step, state);
            return await new Promise((resolve, reject) => {
                disposables.push(
                    pick.onDidAccept(() => {
                        if (!!pick.selectedItems.length) {
                            state.selectedItems = pick.selectedItems;
                            resolve();
                        }
                    }),
                    pick.onDidTriggerButton(item => {
                        if (item !== QuickInputButtons.Back) {
                            resolve();
                            return;
                        }

                        reject(StepStatus.back);
                    }),
                    pick.onDidHide(() => {
                        reject(StepStatus.canecl);
                    }),
                );

                pick.show();
                this.showQuickPickItem(pick, state);

                this._current = pick;
            });
        } finally {
            disposables.forEach(disposable => disposable.dispose());
        }
    }

    async showQuickPickItem(pick: QuickPick<QuickPickItem>, state: QuickPickStep) {
        if (!Array.isArray(state.items)) {
            pick.busy = true;
            pick.items = await state.items();

            pick.enabled = true;
            pick.busy = false;
        } else {
            pick.items = state.items;
            pick.enabled = true;
        }

        pick.activeItems = pick.items.filter(item =>
            state?.selectedItems?.find(v => v.label === item.label),
        );
    }

    createInputBox(step: number, state: InputBoxStep) {
        const input = window.createInputBox();

        input.title = state.title;
        input.value = state.value || '';
        input.placeholder = state.placeholder;
        input.prompt = state.prompt;
        input.password = !!state.password;
        input.step = step;
        input.totalSteps = this._totalSteps;
        input.ignoreFocusOut = true;
        input.buttons = [...(step !== START_STEP ? [QuickInputButtons.Back] : [])];

        return input;
    }

    async showInputBox(step: number, state: InputBoxStep): Promise<void> {
        const disposables: Disposable[] = [];

        try {
            return await new Promise((resolve, reject) => {
                const input = this.createInputBox(step, state);

                disposables.push(
                    input.onDidChangeValue(() => {
                        if (!this.isValidValue(state.validate, input.value)) {
                            input.validationMessage = state.validationMessage || 'Invalid Value.';
                        } else {
                            input.validationMessage = '';
                        }
                        state.value = input.value;
                    }),
                    input.onDidAccept(() => {
                        if (this.isValidValue(state.validate, input.value)) {
                            resolve();
                        }
                    }),
                    input.onDidTriggerButton(item => {
                        if (item !== QuickInputButtons.Back) {
                            resolve();
                            return;
                        }

                        reject(StepStatus.back);
                    }),
                    input.onDidHide(() => {
                        reject(StepStatus.canecl);
                    }),
                );

                input.show();
                this._current = input;
            });
        } finally {
            disposables.forEach(disposable => disposable.dispose());
        }
    }

    isValidValue(validate: InputBoxStep['validate'], value: string) {
        return !validate || validate(value);
    }
}
