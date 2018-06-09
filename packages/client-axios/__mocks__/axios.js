const postFn = jest.fn(async () => { return {}; });

const axiosMock = {
    post: postFn,
    defaults: {
        headers: {
            common: {
                Authorization: null
            }
        }
    }
};

export default {
    create: function () {
        return axiosMock;
    },
    post: postFn,
};