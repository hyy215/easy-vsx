import * as vscode from 'vscode';
import { StepInput } from './step-input';

async function getItems(): Promise<vscode.QuickPickItem[]> {
	return new Promise((resovle) => {
		setTimeout(() => {
			resovle([{
				label: '1',
			}, {
				label: '2'
			}]);
		}, 1000);
	});
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('step-input-demo', async () => {
		const value = await StepInput.run([{
			title: '选择项',
			placeholder: '请选择',
			canSelectMany: false,
			items: getItems
		}, {
			title: '用户名',
			placeholder: '请输入用户名',
			validate: value => !!value,
			validationMessage: '请输入用户名'
		}, {
			title: '密码',
			placeholder: '请输入密码',
			password: true,
			validate: value => !!value,
			validationMessage: '请输入密码'
		}]);

		console.log(value);
	}));
}

export function deactivate() {}
