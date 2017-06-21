module.exports = {
    "root": true,
    "extends": 'airbnb-base',
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    rules: {
        indent: ['error', 2, { SwitchCase: 1, VariableDeclarator: 1, outerIIFEBody: 1 }],
        quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        'no-underscore-dangle': ['off'],
        'max-len': ['error', { code: 128 }],
        'comma-dangle': ["error", {
            arrays: "always-multiline",
            "functions": "never",
            objects: "always-multiline",
            imports: "always-multiline",
            exports: "always-multiline"
        }],
        'import/named': 'error',
        'import/default': 'error',
        'import/namespace': 'error',
    },
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module"
    },
    "settings": {
        "import/ignore": [ 0, [
            "\\.path.js$"
        ] ]
    }
};