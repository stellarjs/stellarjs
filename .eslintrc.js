module.exports = {
    "root": true,
    "env": {
        "es6": true,
        "node": true,
        "jest": true
    },
    plugins: ['fp', 'better-mutation', 'lodash', 'promise'],
    extends: ['plugin:lodash/recommended', 'airbnb-base', "plugin:promise/recommended"],
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
        "no-var": "error",
        'no-console': ['error'],        
        'max-params': ['error', 7], // let's see how bad it can be
        'complexity': ['error', 7],
        'max-depth': ['error', 2],
        'max-statements': ['error', 35],
        'max-nested-callbacks': ['error', 2],
        'func-style': ['error', 'declaration', { allowArrowFunctions: true }],

        'import/no-commonjs': 'error',
        'import/named': 'error',
        'import/default': 'error',
        'import/namespace': 'error',

        "better-mutation/no-mutating-functions": "error",
        "better-mutation/no-mutating-methods": "error",
        "better-mutation/no-mutation": ["error", { allowThis: true, functionProps: true }],
        
        "fp/no-delete": "off",
        "fp/no-valueof-field": "error",
        "fp/no-rest-parameters": "off",
        "fp/no-loops": "warn",
        "fp/no-this": "off",
        "fp/no-nil": "off",
        "fp/no-let": "off",
        "fp/no-throw": "off",
        "fp/no-events": "off",
        "fp/no-get-set": "off",
        "fp/no-arguments": "off",
        "fp/no-unused-expression": "off",

        'lodash/chaining': ['error', 'always'],        
        'lodash/prefer-constant': ['off'],
        'lodash/prefer-matches': ['off'],
        'lodash/matches-prop-shorthand': ['error', "always", {onlyLiterals: true}],
        // 'lodash/prefer-lodash-method': ['error', {ignoreMethods: ['isError']}],
        'lodash/prefer-lodash-typecheck': ['warn'],
    },
    parser: 'babel-eslint',
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